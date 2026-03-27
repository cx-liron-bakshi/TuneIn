# Server-Side Song Pause Feature

## Overview

Room creators can pause and resume the current song. Pausing stops the backend timer so the queue does not advance, and also pauses the YouTube player for all listeners. Resuming restarts the timer with the exact remaining time and syncs all clients.

---

## How It Works

### Backend

**Timer pause/resume** — JavaScript `setTimeout` cannot be natively paused. The implementation tracks when the timer was scheduled and for how long, so the remaining time can be computed on pause and a new timer created on resume.

```
remaining = totalDelay - (Date.now() - scheduledAt)
```

**Pause flow:**
1. `POST /api/song/:roomId/pause` (creator only, requires auth)
2. `TimerManager.pauseTimer(roomId)` — clears the `setTimeout`, returns `remainingMs`
3. Room added to in-memory `roomsPaused` Set
4. MongoDB `currentSong` updated with `{ pausedAt, elapsedAtPause, remainingMs }`
5. `songPaused` socket event emitted to all room members

**Resume flow:**
1. `POST /api/song/:roomId/resume` (creator only, requires auth)
2. Room removed from `roomsPaused`
3. `effectiveStartTime = resumeTime - (elapsedAtPause * 1000)` — adjusts `startTime` so the frontend elapsed-time formula yields the correct frozen value at the moment of resume and advances correctly from there
4. MongoDB `currentSong` updated with new `startTime`; pause fields cleared
5. `TimerManager.resumeTimer(roomId, remainingMs, callback)` — re-arms the natural-end timer
6. `songResumed` socket event emitted with updated song

**Skip while paused** — skip clears `roomsPaused` before calling `playNextSong`, so it always works.

**New joiners** — `GET /api/song/:roomId` returns the full `currentSong` object including `pausedAt`/`elapsedAtPause` when paused. The frontend reads these to show the paused state immediately.

---

### Frontend

**`CurrentSong.js`** (orchestrator)
- Holds `isPaused` state and a `pauseRetryRef` for the player-pause retry loop
- Listens for `songPaused` → sets `isPaused=true`, freezes elapsed display, triggers retry effect
- Listens for `songResumed` → updates `currentSong.startTime` to `effectiveStartTime`, sets `isPaused=false`, calls `window.playYouTubePlayer()`
- Retry effect: when `isPaused` becomes `true`, polls `window.pauseYouTubePlayer()` every 300ms until it returns `true` (player may not be ready immediately, especially on initial load)
- Passes `isPaused` down to `SongWidget` and `SkipSong`

**`MediaPlayer.js`**
- Exposes `window.pauseYouTubePlayer()` and `window.playYouTubePlayer()` globals (set once player is ready, via `[playerReady]` effect)
- No `pauseOnReady` prop — pausing on load is handled by the retry effect in `CurrentSong.js`

**`SongWidget.js`**
- Key is `currentSong?.id` (not `startTime`) — the widget stays mounted across resume; only remounts on a new song
- When `isPaused` becomes `true`: `isPaused` effect clears the interval, freezing the displayed time
- When `isPaused` becomes `false` (resume): `currentSong.startTime` changed → `[currentSong?.id, currentSong?.startTime]` init effect fires → calls `updateProgress()` immediately (no 0:00 flash) → restarts interval from correct position
- Init effect calls `updateProgress()` immediately before the 500ms polling timeout, ensuring the displayed time is always correct from the first render

**`PauseButton.js`** (creator-only)
- Orange **Pause** button when playing; green **Resume** button when paused
- Fires `POST /api/song/:roomId/pause` or `/resume`
- UI state is driven entirely by socket events — no optimistic updates needed

**`SkipSong.js`**
- Renders `PauseButton` to the left of `CreatorSkipButton` in the creator branch

---

## API Reference

| Endpoint | Method | Auth | Creator Only | Description |
|---|---|---|---|---|
| `/api/song/:roomId/pause` | POST | ✓ | ✓ | Pause the current song |
| `/api/song/:roomId/resume` | POST | ✓ | ✓ | Resume the paused song |

### Responses

**Pause success (`200`):**
```json
{ "message": "Song paused", "elapsedAtPause": 42, "remainingMs": 138000 }
```

**Resume success (`200`):**
```json
{ "message": "Song resumed", "effectiveStartTime": 1718000000000 }
```

**Error cases:**
- `400` — already paused / not paused / no song playing / pausing during transition
- `403` — caller is not the room creator
- `404` — room not found

---

## Socket Events

| Event | Direction | Payload | Handler |
|---|---|---|---|
| `songPaused` | server → clients | `{ pausedAt, elapsedAtPause }` | `CurrentSong.js` |
| `songResumed` | server → clients | `{ song, serverTime }` | `CurrentSong.js` |

---

## Modified Files

### Backend
- `backend/src/controllers/insideRoomControllers/helpers/TimerManager.js` — added `pauseTimer`, `resumeTimer`; extended `setSongDurationTimer` to track `scheduledAt` + `delayMs`
- `backend/src/controllers/insideRoomControllers/CurrentSongController.js` — added `roomsPaused`, `pauseSong`, `resumeSong`; updated timer call; cleared pause on skip
- `backend/src/controllers/insideRoomControllers/helpers/RoomSocketEmitter.js` — added `songPaused`, `songResumed`
- `backend/src/routes/insideRoom/CurrentSongRoute.js` — added pause/resume routes

### Frontend
- `tunein-react/src/Components/RoomPage/CurrentSong/MediaPlayer.js` — exposed `window.pauseYouTubePlayer` / `window.playYouTubePlayer` globals
- `tunein-react/src/Components/RoomPage/CurrentSong/SongWidget.js` — added `isPaused` prop; freeze interval on pause; immediate `updateProgress()` call in init effect
- `tunein-react/src/Components/RoomPage/CurrentSong/CurrentSong.js` — `isPaused` state, socket handlers, retry-pause effect, corrected initial load for paused songs
- `tunein-react/src/Components/RoomPage/CurrentSong/SkipSong/PauseButton.js` — **new file**
- `tunein-react/src/Components/RoomPage/CurrentSong/SkipSong/SkipSong.js` — added `PauseButton` to creator controls

---

## Edge Cases

| Scenario | Behaviour |
|---|---|
| Skip while paused | `roomsPaused.delete(roomId)` before `playNextSong` — skip always works |
| Double-pause | Returns `400 Already paused` |
| Double-resume | Returns `400 Song is not paused` |
| Pause during 5-second transition | Returns `400 Cannot pause during song transition` |
| Server restart while paused | In-memory `roomsPaused` lost; timer not re-armed. Song stays frozen until skipped. New joiners still see paused state via MongoDB. |
| Non-creator calling pause/resume | Returns `403 Only the room creator can pause/resume` |
| New joiner on paused room | `fetchCurrentSong` sets `initialStartTimeRef` to `elapsedAtPause` (not live elapsed); retry effect polls until player is ready then calls `pauseVideo()` |
| Resume position accuracy | `effectiveStartTime = resumeTime - elapsedAtPause_ms` ensures `getElapsedSeconds()` returns exactly `elapsedAtPause` at the moment of resume, then advances by 1/s |
| SongWidget key stability | Key is `currentSong?.id` — widget stays mounted on resume, avoiding a remount-triggered 0:00 flash |

---

## Known Limitations

- **Server restart while paused**: the `roomsPaused` Set is in-memory and lost on restart. The song timer will not be re-armed; the room stays frozen until a skip. New joiners still see the paused state correctly (MongoDB retains `pausedAt`/`elapsedAtPause`).
