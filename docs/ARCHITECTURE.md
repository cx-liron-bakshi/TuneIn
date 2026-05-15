# TuneIn — Architecture Reference

> For agents implementing features. Covers structure, data flow, patterns, and gotchas discovered through active development.

---

## Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express, Socket.IO |
| Database | MongoDB Atlas (Mongoose ODM) |
| Frontend | React (Create React App), Material UI |
| Auth | JWT (Bearer token) + Google OAuth |
| Media | YouTube IFrame API |
| Hosting | Northflank PaaS |
| Repo | `github.com/cx-liron-bakshi/TuneIn` |

---

## Repository Layout

```
TuneIn/
├── backend/
│   └── src/
│       ├── app.js                          # Express + Socket.IO setup, port 5000
│       ├── middleware/
│       │   └── auth.js                     # JWT verification → req.user = { userId, email, nickname }
│       ├── models/
│       │   ├── Room.js                     # Room schema
│       │   └── User.js                     # User schema
│       ├── controllers/
│       │   ├── roomBrowserController.js    # Room CRUD
│       │   ├── userController.js           # Profile & points
│       │   └── insideRoomControllers/
│       │       ├── CurrentSongController.js  # Core playback engine ← most critical file
│       │       ├── QueueController.js
│       │       ├── ChatController.js
│       │       ├── UpdateUserPoints.js
│       │       ├── helpers/
│       │       │   ├── TimerManager.js     # setTimeout lifecycle management
│       │       │   └── RoomSocketEmitter.js # All socket.emit calls go through here
│       │       └── VotingSystem/
│       │           ├── SocketHandler.js    # Socket connection/room join/disconnect
│       │           ├── SkipVotingService.js
│       │           ├── LiveViewersController.js
│       │           └── ViewerTrackingService.js
│       └── routes/
│           ├── insideRoom/
│           │   ├── CurrentSongRoute.js
│           │   ├── queueRoutes.js
│           │   ├── LiveViewersRoutes.js
│           │   └── ChatRoute.js
│           ├── roomBrowserRoutes.js
│           └── authRoutes.js
├── tunein-react/
│   └── src/
│       ├── App.js                          # Router
│       ├── Pages/
│       │   ├── RoomPage.js                 # Fetches room data, creates socket, wraps in SocketProvider
│       │   ├── HomePage.js
│       │   └── AuthPage.js
│       └── Components/
│           ├── RoomPage/
│           │   ├── Context/
│           │   │   └── SocketContext.js    # Provides { newSocket, isConnected, roomId, roomCreator }
│           │   ├── CurrentSong/
│           │   │   ├── CurrentSong.js      # Orchestrator — owns all playback state ← most critical frontend file
│           │   │   ├── MediaPlayer.js      # YouTube IFrame wrapper
│           │   │   ├── SongWidget.js       # Progress bar
│           │   │   ├── CountDownMessage.js
│           │   │   └── SkipSong/
│           │   │       ├── SkipSong.js     # Routes creator vs. voter UI
│           │   │       ├── CreatorSkipButton.js
│           │   │       ├── PauseButton.js  # Creator-only pause/resume
│           │   │       ├── VoteSkipButton.js
│           │   │       ├── SkipVoteDisplay.js
│           │   │       └── useLiveViewers.js
│           │   ├── QueueBar/
│           │   │   ├── QueueBar.js
│           │   │   ├── SearchSong.js
│           │   │   ├── PlaylistImport.js   # Playlist URL import (tab sibling to SearchSong)
│           │   │   ├── SongQueue.js
│           │   │   └── SongCard.js
│           │   └── ChatPanel/
│           │       ├── ChatPanel.js
│           │       ├── MessageList.js
│           │       └── UserProfilePopup.js
│           └── HomePage/
│               ├── RoomBrowser.js
│               ├── RoomCard.js
│               └── CreateRoomModal.js
└── docs/
    ├── ARCHITECTURE.md     ← this file
    └── PAUSE_FEATURE.md    ← pause feature deep-dive
```

---

## Database Models

### Room
```js
{
  name: String,
  genres: [String],
  image: String,            // Imgur URL
  creator: ObjectId,        // ref: User — room ownership
  isHidden: Boolean,        // hidden rooms only visible to creator in browser
  createdAt: Date,
  capacity: Number,         // live viewer count, updated dynamically via socket
  songqueue: [Mixed],       // array of song objects (see Song shape below)
  currentSong: Mixed        // null when nothing playing (see Song shape below)
}
```

### Song shape (Mixed, not a sub-schema)
```js
{
  id: String,               // YouTube video ID
  title: String,
  duration: Number,         // seconds
  thumbnail: String,        // YouTube thumbnail URL
  addedby: String,          // user nickname
  startTime: Number,        // ms epoch — set by server at the moment song starts
  triggerSource: String,    // 'initialSongAdded' | 'SkipSong' | 'natural_end'
  // Pause fields (present only while paused):
  pausedAt: Number,         // ms epoch when paused
  elapsedAtPause: Number,   // seconds elapsed when paused
  remainingMs: Number       // timer ms remaining when paused
}
```

### User
```js
{
  googleId: String,
  email: String,
  nickname: String,         // unique, used as display name everywhere
  password: String,         // hashed, absent for Google OAuth users
  genres: [String],
  profilePic: String,
  points: Number            // gamification: +1 natural end, -1 skipped
}
```

---

## Backend: Core Playback Engine

### In-memory state (lost on restart)
```js
// CurrentSongController.js
const roomsInCountdown = new Set(); // rooms in 5-second transition (guards concurrent changes)
const roomsPaused = new Set();      // rooms currently paused

// TimerManager.js
const roomTimers = new Map();       // roomId → { songDurationTimer, scheduledAt, delayMs }

// SkipVotingService.js
const roomSkipVotes = new Map();    // roomId → Set<userId>
```

### Song lifecycle
```
addSongToQueue()
  └─ if queue was empty → playNextSong(roomId, io, 'initialSongAdded')

playNextSong(roomId, io, source)
  ├─ Guard: skip if roomsInCountdown has roomId
  ├─ Clear timer + skip votes
  ├─ Award/deduct points for previous song
  ├─ If queue empty → emit currentSongUpdated(null), done
  ├─ Pop queue[0], update DB
  ├─ Emit nextSongCountdown (5 sec warning)
  ├─ setTimeout 5000ms →
  │    ├─ Set currentSong in DB with startTime = Date.now()
  │    ├─ Emit currentSongUpdated
  │    └─ Emit skipVoteUpdate
  └─ setSongDurationTimer(roomId, timer, delay)
       delay = 5000 + duration*1000 + 1000
       fires → playNextSong(roomId, io, 'natural_end')
```

### Timer pause/resume math
```
// On pause:
elapsedAtPause = floor((pausedAt - song.startTime) / 1000)
remainingMs    = timer.delayMs - (Date.now() - timer.scheduledAt)

// On resume:
effectiveStartTime = resumeTime - (elapsedAtPause * 1000)
// This makes (Date.now() - effectiveStartTime)/1000 = elapsedAtPause at the moment of resume
// and advances correctly from there — frontend formula is unchanged
```

### Points rules
| Source | Points |
|---|---|
| `natural_end` | +1 to song submitter |
| `SkipSong` | -1 to song submitter |
| `initialSongAdded`, `unknown` | no change |

---

## Backend: API Routes

All routes require `Authorization: Bearer <jwt>`.

```
GET  /api/song/:roomId              getCurrentSong → { currentSong, serverTime }
POST /api/song/:roomId/skip         skipSong (creator in practice, no server enforcement)
POST /api/song/:roomId/pause        pauseSong (creator enforced via room.creator check)
POST /api/song/:roomId/resume       resumeSong (creator enforced)

GET  /api/queue/:roomId                      getQueue
POST /api/queue/:roomId/add                  addSongToQueue
DEL  /api/queue/:roomId/:songIndex           removeSongFromQueue
POST /api/queue/:roomId/import-playlist      importPlaylistToQueue (body: { playlistUrl })

GET  /api/live-viewers/:roomId               viewer count + skip state
POST /api/live-viewers/:roomId/vote-skip     toggle skip vote

POST /api/chat/:roomId/send         send message

GET  /api/rooms?page=1&limit=20     list rooms (paginated, hidden rooms only shown to creator)
POST /api/rooms                     createRoom
GET  /api/rooms/:roomId             getRoom (returns creator populated)

GET  /api/user/profile              current user profile
POST /api/auth/login
POST /api/auth/register
GET  /api/auth/google               Google OAuth entry
GET  /api/auth/google/callback
POST /api/auth/google/exchange      Exchange one-time code for JWT (used after OAuth redirect)
```

---

## Backend: Socket Events

### Server → Clients
| Event | Payload | Trigger |
|---|---|---|
| `currentSongUpdated` | `{ currentSong, serverTime }` | Song starts or queue empties |
| `nextSongCountdown` | `{ countdown, nextSong, source }` | 5s before song starts |
| `queueUpdated` | `{ queue, source }` | Any queue change |
| `skipVoteUpdate` | `{ liveViewers, skipCount, threshold, source }` | Vote cast or viewer count changes |
| `songSkippedByVote` | `{ reason, voteCount, threshold }` | Skip threshold reached |
| `viewerCountUpdate` | `{ liveViewers, reason }` | Join/leave/disconnect |
| `newChatMessage` | `{ message, nickname, ... }` | Chat message sent |
| `songPaused` | `{ pausedAt, elapsedAtPause }` | Creator pauses |
| `songResumed` | `{ song, serverTime }` | Creator resumes |

### Client → Server (socket.emit)
| Event | Payload | Purpose |
|---|---|---|
| `joinRoom` | `roomId` | Enter room, tracked for viewer count |
| `leaveRoom` | `roomId` | Leave room |

> Note: `setUserId` was removed. User identity is now extracted from the JWT during socket authentication middleware.

---

## Frontend: Context Chain

```
RoomPage
  └─ fetches room via GET /api/rooms/:roomId → gets { creator, name, ... }
  └─ creates socket: io(API_URL, { auth: { token } })
  └─ emits joinRoom(roomId)
     └─ SocketProvider (SocketContext.js)
          provides: { newSocket, isConnected, roomId, roomCreator }
          consumed via: const { newSocket, roomId, roomCreator } = useSocket()
```

### Creator detection pattern (used everywhere)
```js
const isCreator = useMemo(() => {
  const userId = localStorage.getItem('userId');
  return userId && roomCreator && roomCreator._id === userId;
}, [roomCreator]);
```

### Auth in localStorage
```js
localStorage.getItem('authToken')  // JWT for API calls
localStorage.getItem('userId')     // MongoDB ObjectId string for creator checks
```

---

## Frontend: CurrentSong.js (Orchestrator)

Owns all playback state. Everything else is a controlled child.

```
State:
  currentSong       — the playing song object (includes startTime)
  isPaused          — boolean
  serverTimeDiff    — ms offset between server and client clocks
  isIntroPlaying    — boolean (plays INTRO_VIDEO_ID = 'UVsHJP1D_Io' when queue empty)
  countdownData     — { countdown, nextSong } for 5-second transition display

Refs:
  initialStartTimeRef  — seconds to pass as YouTube startTime on player init
  pauseRetryRef        — timeout handle for the pause retry loop

Key formula:
  getElapsedSeconds() = floor((Date.now() + serverTimeDiff - currentSong.startTime) / 1000)
  // When isPaused: returns frozen currentSong.elapsedAtPause instead

Socket handlers registered here:
  currentSongUpdated → update currentSong, reset isPaused
  nextSongCountdown  → update countdownData
  songPaused         → set isPaused=true, update currentSong with pause fields
  songResumed        → update currentSong.startTime to effectiveStartTime, set isPaused=false

Pause retry effect:
  When isPaused=true: polls window.pauseYouTubePlayer() every 300ms until it returns true
  (handles race where fetch resolves before YouTube player is ready)

Props passed down:
  SongWidget:   key={currentSong?.id}  currentSong  getElapsedSeconds  isPaused
  SkipSong:     onSkip  isPaused
  MediaPlayer:  videoId  startTime={initialStartTimeRef.current}  muted  onEnded
```

---

## Frontend: MediaPlayer.js

Thin wrapper around YouTube IFrame API. One instance lives for the lifetime of the room.

```
Player is created once when apiLoaded=true (deps: [apiLoaded])
  playerVars.start = startTime prop (only read at creation — seek manually to change position)
  onReady → playVideo(), setPlayerReady(true)
  onStateChange → fires onEnded prop when ENDED

When videoId prop changes (new song):
  playerInstance.loadVideoById({ videoId, startSeconds: 0 })
  (isInitialLoadRef guards against this firing on first load)

When videoId is null:
  playerInstance.stopVideo()

Global window functions (set in [playerReady] effect):
  window.getYouTubePlayerCurrentTime()       → getCurrentTime()
  window.setYouTubePlayerCurrentTime(time)   → seekTo(time, true)
  window.pauseYouTubePlayer()               → pauseVideo(), returns true/false
  window.playYouTubePlayer()                → playVideo(), returns true/false
```

**Critical gotcha:** `startTime` is only read at player creation, not on prop change. To seek an already-running player, call `window.setYouTubePlayerCurrentTime(seconds)`.

---

## Frontend: SongWidget.js

Progress bar + sync button. Remounts when `key` changes (new song = new `currentSong.id`).

```
Init useEffect deps: [currentSong?.id, currentSong?.startTime]
  — fires on new song (id changes) AND on resume (startTime changes to effectiveStartTime)
  — calls updateProgress() immediately (no 0:00 flash)
  — then starts 1-second setInterval

isPaused useEffect:
  — when isPaused=true: clears interval + timeout (freezes display)
  — resume is handled automatically: effectiveStartTime change → deps fire → interval restarts

Sync button:
  calls window.setYouTubePlayerCurrentTime(getElapsedSeconds())
  seeks YouTube player to match the widget's calculated position
```

---

## Frontend: Skip/Pause Controls (SkipSong.js)

Routes to creator or voter UI based on `isCreator`:

```
Creator branch:
  <PauseButton isPaused={isPaused} />      ← orange/green toggle, POST /pause or /resume
  <CreatorSkipButton onSkip={onSkip} />    ← red, POST /skip (instant)
  <SkipVoteDisplay showCreatorMode={true} />

Voter branch:
  <VoteSkipButton onVote={submitSkipVote} />   ← POST /vote-skip
  <SkipVoteDisplay showCreatorMode={false} />
```

### Skip vote threshold
```
1 viewer  → 1 vote needed
2 viewers → 2 votes needed
3+ viewers → floor(viewers/2) + 1 votes needed
```

---

## Key Patterns for Feature Development

### Adding a new creator-only API action
1. Add handler in `CurrentSongController.js` — check `String(room.creator) !== String(req.user.userId)` → 403
2. Add route in `CurrentSongRoute.js` with `auth` middleware
3. Add emitter method in `RoomSocketEmitter.js`
4. Handle the socket event in `CurrentSong.js`
5. Add a button component mirroring `CreatorSkipButton.js` (same structure, same styling pattern)
6. Render it in the creator branch of `SkipSong.js`

### Adding a new socket event
1. Add emit method to `RoomSocketEmitter.js`
2. Call it from the controller
3. Add `newSocket.on('eventName', handler)` in the relevant React component
4. Add `newSocket.off('eventName', handler)` in the cleanup return

### Adding room-level persistent state
- `currentSong` is `Mixed` — just spread new fields onto it before `findByIdAndUpdate`
- For per-room flags that survive page refresh: add to `Room` schema or store in `currentSong`
- For per-room flags that can reset on server restart: use in-memory Sets/Maps (see `roomsPaused`, `roomsInCountdown`)

### Time synchronization
Always use `serverTimeDiff` when calculating elapsed time:
```js
const elapsed = (Date.now() + serverTimeDiff - song.startTime) / 1000
```
`serverTimeDiff` is set from every `serverTime` field returned by the API.

---

## Environment Variables

### Backend (`backend/.env`)
```
MONGO_URI              MongoDB Atlas connection string
JWT_SECRET             Token signing secret
IMGUR_CLIENT_ID        Image upload for room covers
IMGUR_CLIENT_SECRET
YOUTUBE_API_KEY        Song search
OAUTH_CLIENT_ID        Google OAuth
OAUTH_CLIENT_SECRET
GOOGLE_CALLBACK_URL    http://localhost:5000/api/auth/google/callback
SESSION_SECRET
FRONTEND_URL           http://localhost:3000 (local) / https://tuneinapp.me (prod)
                       (SERVER_URL no longer needed — internal calls use direct function calls)
```

### Frontend (`tunein-react/.env`)
```
REACT_APP_API_URL      Backend base URL (http://localhost:5000 local / prod URL)
REACT_APP_SOCKET_URL   Same as above (Socket.IO connection)
```

Both `.env` files are gitignored. Production values are set directly in Northflank service environment settings.

---

## Production Infrastructure (Northflank)

- **Platform:** Northflank PaaS, account `cx-liron-bakshi` (previously `Liron4`)
- **Project:** `tunein`
- **Services:** `frontend` and `backend` deployed separately
- **Frontend URL:** `tuneinapp.me`
- **Backend URL:** `backend--backend-deployment--gs82jsxjhjwv.code.run`
- **GitHub integration:** `cx-liron-bakshi/TuneIn`, branch `main`, auto-deploy on push
- **Frontend build:** `npm run build` (CRA static export)
- **Backend run:** `npm start` → `node src/app.js` (use `npm run dev` → nodemon locally)

---

## Security

| Feature | Implementation |
|---|---|
| Security headers | `helmet.js` middleware |
| Rate limiting | `express-rate-limit` — 100 req/15min general, 20 req/15min on auth |
| Body size limit | `express.json({ limit: '1mb' })` |
| Session cookies | `httpOnly`, `sameSite: strict`, `secure` in production |
| Socket.io auth | JWT verified via middleware on connection — `socket.userId` set from token |
| OAuth flow | One-time code exchange (POST `/api/auth/google/exchange`) — token never in URL |
| Chat sanitization | `xss` library on server before storing/emitting messages |
| Playlist URLs | Whitelist: only `youtube.com`, `music.youtube.com`, `m.youtube.com` domains accepted |
| Email validation | `validator.isEmail()` on registration |

---

## Known Limitations & Gotchas

| Issue | Detail |
|---|---|
| In-memory state resets on deploy | `roomsPaused`, `roomsInCountdown`, `roomTimers`, `roomSkipVotes` all live in process memory. A deploy clears them. Paused rooms stay stuck until skipped; countdown rooms may double-advance. |
| ~~`SERVER_URL` fallback~~ | Fixed — `SkipVotingService` now calls `CurrentSongController.playNextSong()` directly instead of making HTTP requests to itself. |
| YouTube `startTime` is init-only | `playerVars.start` only applies at player creation. To seek a running player, always use `window.setYouTubePlayerCurrentTime()`. |
| `pauseOnReady` was removed | An earlier attempt used a `pauseOnReady` prop on MediaPlayer. It was unreliable due to async fetch timing. The retry-loop effect in `CurrentSong.js` replaced it. Don't re-add it. |
| SongWidget key is `currentSong?.id` | Changing this to `startTime` causes a remount on resume → 0:00 flash. Keep it as `id`. |
| Song duration source | `duration` comes from YouTube search results and is in seconds. The backend timer formula is `5000 + duration*1000 + 1000ms buffer`. |
| Creator check inconsistency | `skipSong` does not enforce creator-only on the server (it relies on frontend routing). `pauseSong`/`resumeSong` do enforce it. New creator-only features should always enforce server-side. |
