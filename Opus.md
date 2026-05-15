# Opus-Suggestions — Change Log

All changes implemented in this branch were generated from a full codebase audit conducted with Claude Opus 4.6. Items are organized by priority as originally categorized.

---

## P0 — Critical Security

### 1. Strong JWT & Session Secrets
- **File:** `backend/.env`
- Replaced placeholder secrets (`your_super_secret_key_here`, `another_super_secret_key_here`) with cryptographically strong 64-byte hex secrets.
- **Action required:** Update `JWT_SECRET` and `SESSION_SECRET` in Northflank environment variables with fresh strong values (different from the local ones).

### 2. OAuth Token — One-Time Code Exchange
- **Files:** `backend/src/controllers/authControllers/googleAuthController.js`, `backend/src/routes/authRoutes.js`, `tunein-react/src/Pages/AuthCallbackPage.js`
- Previously, the JWT was passed directly in the URL query string after Google OAuth (`?token=...`), exposing it in browser history, server logs, and referrer headers.
- **Fix:** Backend now generates a random one-time code (valid 60 seconds), redirects with `?code=...` instead. Frontend makes a POST to `/api/auth/google/exchange` to trade the code for the JWT. Code is deleted immediately after use.

### 3. Socket.io Authentication Middleware
- **Files:** `backend/src/controllers/insideRoomControllers/VotingSystem/SocketHandler.js`, `tunein-react/src/Components/RoomPage/Context/SocketContext.js`
- Previously, any unauthenticated client could connect and join/vote/skip in any room.
- **Fix:** Added `io.use()` middleware that verifies the JWT from `socket.handshake.auth.token` on every connection. `socket.userId` is now set from the token, not from the client-emitted `setUserId` event (which was removed as a security hole).

### 4. Rate Limiting
- **File:** `backend/src/app.js`
- **Added:** `express-rate-limit` — 100 requests/15min globally on `/api/`, 20 requests/15min on `/api/auth/`.

### 5. Security Headers (Helmet.js)
- **File:** `backend/src/app.js`
- **Added:** `helmet()` middleware — sets X-Content-Type-Options, X-Frame-Options, CSP, and other protective headers.

### 6. Cookie Security Flags
- **File:** `backend/src/app.js`
- Added `httpOnly: true`, `sameSite: 'strict'`, `maxAge: 7d` to session cookie config.

### 7. JSON Body Size Limit
- **File:** `backend/src/app.js`
- `express.json()` now enforces `{ limit: '1mb' }` to prevent large payload DoS.

---

## P1 — High Severity

### 8. XSS Sanitization on Chat Messages
- **File:** `backend/src/controllers/insideRoomControllers/ChatController.js`
- Chat messages are now sanitized with the `xss` npm package before being stored and emitted. Prevents stored XSS attacks.

### 9. Playlist URL Whitelist
- **File:** `backend/src/controllers/insideRoomControllers/QueueController.js`
- Previously accepted any URL for playlist import (SSRF risk).
- **Fix:** Now validates URL and only allows `youtube.com`, `www.youtube.com`, `music.youtube.com`, `m.youtube.com`. Returns 400 for invalid/non-YouTube URLs.

### 10. Email Format Validation on Registration
- **File:** `backend/src/controllers/authControllers/registerController.js`
- Added `validator.isEmail()` check on registration. Previously accepted any string as email.

### 11. Points System (Verified Not Exposed)
- `updatePoints` in `userController.js` is not wired to any route — it was internal-only all along. This was a false alarm in the original audit.

### 12. OAuth CSRF (Verified Handled by Passport)
- Passport's Google OAuth strategy handles the `state` parameter automatically when sessions are enabled. No additional fix needed.

---

## P2 — Code Quality & Architecture

### 13. Console.log Cleanup
- **Backend files:** `passport.js`, `registerController.js`, `UpdateUserPoints.js`, `SkipVotingService.js`, `app.js`
- **Frontend files:** `RoomPage.js`, `SongQueue.js`, `SearchSong.js`, `useLiveViewers.js`, `RoomBrowser.js`
- Removed all debug `console.log` and `console.warn` statements. Error `console.error` in catch blocks preserved.

### 14. Replace `alert()` with MUI Snackbar
- **File:** `tunein-react/src/Components/RoomPage/ChatPanel/ChatPanel.js`
- Network error alerts replaced with a proper MUI `Snackbar` + `Alert` component.
- RoomPage's 404 alert removed (user is navigated away anyway).

### 15. Replace `window.location.href` with React Router `navigate()`
- **File:** `tunein-react/src/Components/RoomPage/ChatPanel/ChatPanel.js`
- Three instances of `window.location.href = '/auth'` replaced with `useNavigate()` from React Router.
- Note: `AuthPage.js` still uses `window.location.href` for the Google OAuth redirect — this is intentional (external URL).

### 16. Error Boundary
- **Files:** `tunein-react/src/Components/.reusable/ErrorBoundary.js` (new), `tunein-react/src/App.js`
- Added a React class `ErrorBoundary` component wrapping the entire app. Catches uncaught render errors and shows a friendly "Something went wrong / Refresh Page" screen instead of a blank page.

### 17. SkipVotingService — Remove Self-HTTP Call
- **File:** `backend/src/controllers/insideRoomControllers/VotingSystem/SkipVotingService.js`
- Previously called `axios.post(process.env.SERVER_URL + '/api/song/:roomId/skip')` — an HTTP request to its own server.
- **Fix:** Now calls `CurrentSongController.playNextSong()` directly. Removed `axios` import. `SERVER_URL` env var is no longer needed.

### 18. UpdateUserPoints — Remove Mock req/res
- **File:** `backend/src/controllers/insideRoomControllers/UpdateUserPoints.js`
- Previously created fake `req`/`res` objects to call `userController.updatePoints()` — a hacky workaround.
- **Fix:** Rewrote to use `User.findOne({ nickname })` + `user.save()` directly. Much simpler, no indirection.

### 19. Room Listing Pagination
- **Files:** `backend/src/controllers/roomBrowserController.js`, `tunein-react/src/Components/HomePage/RoomBrowser.js`
- Room listing now supports `?page=1&limit=20` query parameters (default: page 1, limit 20, max 50).
- Response shape changed from `Room[]` to `{ rooms: Room[], pagination: { page, limit, total, totalPages } }`.
- Frontend updated to read `response.data.rooms`.

### 20. Constants File for Hardcoded Values
- **File:** `tunein-react/src/constants.js` (new)
- Extracted hardcoded asset paths and IDs:
  - `DEFAULT_PROFILE_IMAGE` — used in `Register.js`
  - `DEFAULT_ROOM_IMAGE` — used in `CreateRoomModal.js` and `RoomCard.js`
  - `INTRO_VIDEO_ID` — used in `CurrentSong.js`

### 21. Passport Session Serialization (Verified Correct)
- `serializeUser` already stores only `user.id`. No change needed.

### 22. Removed Empty/Unused Files
- Deleted `tunein-react/src/Components/HomePage/SearchSystem.js` (empty, 1 line)
- Deleted `tunein-react/src/App.css` (CRA boilerplate, not imported anywhere)

---

## P3 — Performance, Accessibility & DX

### 23. React.memo on Presentational Components
- **Files:** `tunein-react/src/Components/HomePage/RoomCard.js`, `tunein-react/src/Components/RoomPage/ChatPanel/Message.js`
- Wrapped both with `React.memo()` to prevent unnecessary re-renders.

### 24. Fixed List Keys
- **File:** `tunein-react/src/Components/RoomPage/QueueBar/SongQueue.js` — key changed from `` `${song.id}-${index}` `` to `song.id`
- **File:** `tunein-react/src/Components/RoomPage/ChatPanel/MessageList.js` — key fallback changed from `` message.id || `msg-${index}` `` to `message.id || message.timestamp`

### 25. Image Lazy Loading
- **File:** `tunein-react/src/Components/HomePage/RoomCard.js`
- Added `loading="lazy"` to the CardMedia component for room card images.

### 26. ARIA Labels
- **File:** `tunein-react/src/Components/RoomPage/ChatPanel/ChatPanel.js`
- Added `aria-label="Send message"` to the Send IconButton.
- QueueBar already had `aria-label` on its toggle — no change needed.

### 27. ESLint for Backend
- **Files:** `backend/.eslintrc.json` (new), `backend/package.json`
- Added ESLint config with `eslint:recommended`, node environment, warnings for `no-unused-vars` and `no-console`.
- Added `"lint": "eslint src/"` script.

### 28. Testing Libraries → devDependencies
- **File:** `tunein-react/package.json`
- Moved `@testing-library/dom`, `@testing-library/jest-dom`, `@testing-library/react`, `@testing-library/user-event` from `dependencies` to `devDependencies`.

### 29. API Documentation Updated
- **File:** `docs/ARCHITECTURE.md`
- Added Security section documenting all new middleware.
- Updated Socket events table (removed `setUserId`).
- Updated API routes (added `POST /api/auth/google/exchange`, updated room listing to show pagination).
- Updated Known Limitations (marked `SERVER_URL` self-call as fixed).

---

## Packages Added

### Backend
```
npm install helmet express-rate-limit xss validator
npm install --save-dev eslint
```

### Frontend
No new packages added (moved testing libs to devDependencies).

---

## Project Context (Gathered During This Session)

### Deployment — Northflank (Europe-West)
Both services deploy from the `main` branch of `cx-liron-bakshi/TuneIn` on Northflank using **Heroku buildpacks** (not Dockerfiles).

**Frontend** (Service ID: `frontend`)
- Build context: `/tunein-react`
- Buildpack detects Node.js, runs `npm install` + `npm run build`
- Build args injected: `REACT_APP_API_URL`, `REACT_APP_SOCKET_URL`
- Has a `Dockerfile` in the repo but it is **not used** (buildpack is selected)

**Backend** (Service ID: `backend-deployment`)
- Build context: `/backend`
- Resources: 0.2 vCPU / 512 MB
- Env vars managed in Northflank (not in repo): `MONGO_URI`, `JWT_SECRET`, `IMGUR_CLIENT_ID`, `IMGUR_CLIENT_SECRET`, `YOUTUBE_API_KEY`, `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `SESSION_SECRET`, `FRONTEND_URL`

The local `backend/.env` and `tunein-react/.env` files are dev-only and gitignored. Production values live exclusively in Northflank.

> **Note:** Any new env vars added to the code must also be added to Northflank's environment settings before deploying.

### Design Decisions
- **Mongoose Mixed types on Room model** — `songqueue` and `currentSong` are intentionally `Schema.Types.Mixed` for flexibility. Do not refactor to strict sub-schemas.
- **SERVER_URL** — was previously needed by `SkipVotingService` for self-HTTP calls. No longer needed after the refactor in this branch.

### Future Releases Identified
| Feature | Notes |
|---|---|
| CRA → Vite migration | Requires code changes (`REACT_APP_*` → `VITE_*`, `process.env` → `import.meta.env`) + Northflank config updates (env var names, Procfile build dir `build` → `dist`). Buildpack still works — just a Node.js `npm run build`. |
| JWT → HTTP-only cookies | Full auth flow overhaul — both backend (set cookie on login/OAuth) and frontend (remove localStorage token, send credentials on all requests). |
| Redis for in-memory state | `roomsPaused`, `roomsInCountdown`, `roomTimers`, `roomSkipVotes` all reset on server restart/deploy. Redis would make these persistent and horizontally scalable. |

---

## Things NOT Done (Skipped or Deferred)

| Item | Reason |
|---|---|
| JWT tokens → HTTP-only cookies | High-risk refactor requiring full auth flow overhaul across frontend + backend |
| Token refresh/expiration handling | Depends on cookie-based auth above |
| Redis for in-memory state | Not feasible without infrastructure changes |
| Loose Mongoose Mixed types | User prefers flexible schema |
| TypeScript migration | Not starting now |
| Backend tests | Skipped |
| CI/CD pipeline | Using Northflank |
| Backend Dockerfile | Using Northflank buildpacks |
| CRA → Vite migration | **Future release** — requires code changes (env var prefix `REACT_APP_*` → `VITE_*`) and Northflank config updates |
| docker-compose for local dev | Skipped |
| Standardize error response format | High-risk, low-impact; would require updating all frontend error parsers |
