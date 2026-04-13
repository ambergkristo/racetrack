# Racetrack info-screens

Live app:
- `https://racetrack-wf9v.onrender.com`

## ⚠️ Important (Render cold start)

The deployed backend may take up to 30 seconds to wake up after inactivity.

If the app appears unresponsive:
- wait about 30 seconds
- refresh the page

Single-host Node.js app for running Beachside Racetrack staff screens and public display screens.

- Backend: Express + Socket.IO
- Frontend: static SPA served by the same Node process
- Realtime transport: `websocket` only
- Minimum Node version: `18+`

## Repository structure

- `server/`: backend entrypoints, backend source, and generated static build output
- `server/server.js`: backend runtime entrypoint used by `npm run dev` and `npm start`
- `server/index.js`: backend module entrypoint exported for tests
- `server/src/app/`: server composition, routes, middleware, services, and socket wiring
- `server/src/domain/`: race lifecycle, timer, store, and business rules
- `server/src/persistence/`: persistence adapter
- `client/`: frontend browser entry files
- `client/src/`: feature-based frontend source fragments used to generate `client/app.js`
- `tests/`: integration, regression, and UI contract tests

## Prerequisites

- Node.js `18` or newer
- npm

## Installation

```bash
npm install
```

## Environment variables

Copy the example file:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

### Required by default

These keys are required unless `STAFF_AUTH_DISABLED=true`:

- `FRONT_DESK_KEY`
- `RACE_CONTROL_KEY`
- `LAP_LINE_TRACKER_KEY`

### Optional

- `PORT`
  Default: `3000`
- `RACE_DURATION_SECONDS`
  If omitted: `60` in dev, `600` in production
- `AUTH_FAILURE_DELAY_MS`
  Default: `500`
- `FF_PERSISTENCE`
  Default: `false`
- `FF_MANUAL_CAR_ASSIGNMENT`
  Default: `false`
- `STAFF_AUTH_DISABLED`
  Default: `false`
- `PERSISTENCE_FILE_PATH`
  Default: `./data/race-state.json`
- `DOTENV_PATH`
  Optional override for the `.env` file location

## Local run

### Development

```bash
npm run dev
```

This starts the server with:

- `NODE_ENV=development`
- `nodemon`
- frontend sync from `client/src/` into `client/app.js` before startup

### Production-style local run

```bash
npm run build
npm start
```

`npm run build` copies `client/` to `server/public/`. `npm start` then serves the built assets from there.

## Local routes

Base URL:

- `http://localhost:3000`

Staff routes:

- `http://localhost:3000/front-desk`
- `http://localhost:3000/race-control`
- `http://localhost:3000/lap-line-tracker`

Public routes:

- `http://localhost:3000/leader-board`
- `http://localhost:3000/next-race`
- `http://localhost:3000/race-countdown`
- `http://localhost:3000/race-flags`

Health and bootstrap:

- `http://localhost:3000/healthz`
- `http://localhost:3000/api/bootstrap`

## Auth and startup behavior

- Staff routes are gated by a key prompt in the client.
- The client verifies the key through `POST /api/auth/verify` before it opens a staff Socket.IO connection.
- Public routes do not require a key and connect immediately.
- If `STAFF_AUTH_DISABLED=true`, the staff prompt is bypassed and staff socket connections are allowed without a key.
- Socket.IO stays on `websocket` transport only. Polling is not used.

## Frontend workflow

Frontend source-of-truth now lives under `client/src/` and is split by app/shared/features folders.

Generate `client/app.js` manually if needed:

```bash
npm run sync:client
```

You do not need to run that separately for normal workflows because it already runs before:

- `npm run dev`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm start`

## Validation commands

```bash
npm run lint
npm test
npm run build
```

Additional available test command:

```bash
npm run test:m3-matrix
```

## Operating notes

- `GET /api/bootstrap` returns feature flags, server time, auth mode, and the canonical race snapshot.
- SPA deep-linking is enabled for all listed routes.
- Public display routes keep fullscreen controls available.
- Race lifecycle, socket contract, and timer behavior are covered by the regression suite in `tests/`.

## Troubleshooting

- Startup fails with missing env vars:
  Copy `.env.example` to `.env`, or set `STAFF_AUTH_DISABLED=true` for demo-only bypass mode.
- Port `3000` is already in use:
  Set `PORT` in `.env` before running the server.
- Built assets look stale:
  Run `npm run build` again. The build copies the current `client/` directory into `server/public/`.
- Frontend source fragments changed but `client/app.js` was not refreshed:
  Run `npm run sync:client`.
- Staff login keeps failing:
  Confirm the route-specific key in `.env` matches the value you enter in the prompt.

## Deployment note

The repository also includes a deployed Render instance referenced in project discussions, but the commands above describe the verified local workflow from this repository itself.
