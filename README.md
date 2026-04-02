# Racetrack info-screens

## ⚠️ Important (Render cold start)

The deployed backend may take up to 30 seconds to wake up after inactivity.

If the app appears unresponsive:
- wait about 30 seconds
- refresh the page

Single-host M1 setup:
- one Node.js server
- serves the frontend SPA
- hosts Socket.IO on the same process

## Route List

Staff routes:
- `/front-desk`
- `/race-control`
- `/lap-line-tracker`

Public routes:
- `/leader-board`
- `/next-race`
- `/race-countdown`
- `/race-flags`

SPA deep-linking is enabled for all routes above (refresh does not 404).

## Realtime and API Rules

- Realtime updates use Socket.IO.
- Polling for live updates is not allowed (Socket.IO is configured for `websocket` only).
- REST is used only for handshake/health style calls:
  - `GET /healthz`
  - `GET /api/bootstrap`
  - `POST /api/auth/verify`

Socket contract docs:
- `docs/contracts/socket-contract-m0.md` (M0 baseline freeze)
- `docs/contracts/socket-contract-m1.md` (M1 realtime lifecycle)

Diagnostics docs:
- `docs/diagnostics/observability-baseline.md` (M2 structured logs and key error surfaces)

## Required Environment Variables

These keys are required at startup (fail-fast if missing):
- `FRONT_DESK_KEY`
- `RACE_CONTROL_KEY`
- `LAP_LINE_TRACKER_KEY`

Other env vars:
- `PORT` (default `3000`)
- `RACE_DURATION_SECONDS` (optional explicit override)
- `AUTH_FAILURE_DELAY_MS` (optional; defaults to `500`)
- `FF_PERSISTENCE` (optional; defaults to `false`)
- `FF_MANUAL_CAR_ASSIGNMENT` (optional; defaults to `false`)
- `STAFF_AUTH_DISABLED` (optional; defaults to `false`)

Notes:
- Server env is centralized in `src/config/env.js`.
- `.env` is loaded automatically on startup (override with `DOTENV_PATH` if needed).
- `STAFF_AUTH_DISABLED=true` is a demo/testing convenience only. It bypasses the staff key gate on `/front-desk`, `/race-control`, and `/lap-line-tracker`.
- If `STAFF_AUTH_DISABLED` is omitted or set to `false`, the canonical staff auth flow is unchanged.
- If `STAFF_AUTH_DISABLED=true`, the three staff keys are no longer required at startup.

Timer defaults:
- `npm run dev` => 60 seconds
- `npm start` => 600 seconds

## Access Keys (for testing)

For evaluation and demo use, the default testing keys are:
- Front Desk: `erkinool`
- Race Control: `erkinool`
- Lap Line Tracker: `erkinool`

These values can be changed through environment variables, but they are intended only as testing defaults and not as production-grade security secrets.

## Local Run

1. Copy env file:
   - `cp .env.example .env` (or create `.env` manually on Windows)
2. Install dependencies:
   - `npm install`
3. Choose one of these setup options for staff access keys:
   - Recommended: keep the values from `.env.example` in `.env`
   - Manual export example:

```bash
export FRONT_DESK_KEY=erkinool
export RACE_CONTROL_KEY=erkinool
export LAP_LINE_TRACKER_KEY=erkinool
npm start
```

4. Build frontend assets:
   - `npm run build`
5. Start production mode:
   - `npm start`

Development mode:
- `npm run dev`

Demo/testing mode without staff key prompts:
- set `STAFF_AUTH_DISABLED=true` in `.env`
- run `npm run dev` or `npm run build && npm start`

## How to Use the System

### Front Desk flow

1. Start the server with `npm run dev` or `npm start`.
2. Open `/front-desk`.
3. Enter the Front Desk access key when prompted.
4. Create a new race session.
5. Add racers to the active session one by one.
6. Check that each racer has the correct assigned car number.
7. If another race should happen after the current one, create the next session and keep it queued.

### Race Control flow

1. Open `/race-control`.
2. Enter the Race Control access key.
3. Confirm the correct session is staged before starting.
4. Start the race manually when the cars are ready.
5. Use the race mode buttons during the run:
   - `SAFE` for normal pace
   - `HAZARD_SLOW` to slow the field
   - `HAZARD_STOP` to stop or nearly stop the field
6. When the race has finished, move it into `FINISHED`.
7. End and lock the session only after the cars have completed pit return.

### Lap Line Tracker usage

1. Open `/lap-line-tracker`.
2. Enter the Lap Line Tracker access key.
3. Use the large racer cards to record each real lap-line crossing.
4. Keep using lap entry while the race is running.
5. If the race is already in `FINISHED`, record any final valid crossings that still happen before pit return completes.

### Simulation usage

1. Open `/front-desk`.
2. Enter the Front Desk access key.
3. Create a session.
4. Add racers to that session.
5. Make sure the session is the active staged session before you try to simulate it.
6. Open `/lap-line-tracker`.
7. Enter the Lap Line Tracker access key.
8. Press `Simulate`.

Warning: Simulation will not start if no session is staged.

9. Watch the track view in Lap Line Tracker:
   - cars start from pit lane
   - lap 1 starts only after each car crosses the lap line for the first time
   - hazard phases can appear during the run
   - after lap 5 the race enters `FINISHED`
   - cars continue through the finish flow and then return to pit lane
10. Monitor the public routes during the run:
   - `/leader-board` shows live order and lap timing
   - `/race-flags` shows the current public race mode
   - `/next-race` shows the current and upcoming session lineup
   - `/race-countdown` shows the live session timer
11. Wait for pit return to complete.
12. Confirm that the next queued session becomes staged automatically after the finished cars are back in pit/garage.

### Session ending logic

1. Do not treat checkered as instant session completion.
2. Let the active session stay authoritative through finish handling and pit return.
3. Lock the session only after the finishing flow is complete.
4. If a next session is queued, verify it becomes the new staged session.

### Public display explanation

1. Use `/leader-board` for live order, lap counts, and timing.
2. Use `/race-flags` for the current public flag state.
3. Use `/race-countdown` for the visible session timer.
4. Use `/next-race` to show who is on track now and who is up next.
5. These public routes are designed for display screens and can be used in fullscreen mode.

## Health Check

- `GET /healthz` returns HTTP 200 and runtime metadata.

## Deployed URL + Routes

Base URL:
- `https://racetrack-wf9v.onrender.com`

Health:
- `https://racetrack-wf9v.onrender.com/healthz`

Route URLs:
- `https://racetrack-wf9v.onrender.com/front-desk`
- `https://racetrack-wf9v.onrender.com/race-control`
- `https://racetrack-wf9v.onrender.com/lap-line-tracker`
- `https://racetrack-wf9v.onrender.com/leader-board`
- `https://racetrack-wf9v.onrender.com/next-race`
- `https://racetrack-wf9v.onrender.com/race-countdown`
- `https://racetrack-wf9v.onrender.com/race-flags`

## Render Deployment Instructions

1. Create a new Web Service in Render from this repo.
2. Runtime: Node.
3. Build command:
   - `npm ci && npm run build`
4. Start command:
   - `npm start`
5. Set environment variables in Render:
   - `PORT` (Render usually provides this automatically)
   - `FRONT_DESK_KEY`
   - `RACE_CONTROL_KEY`
   - `LAP_LINE_TRACKER_KEY`
   - optional `STAFF_AUTH_DISABLED=true` for demo/testing-only staff route access
   - optional `RACE_DURATION_SECONDS`
   - optional `AUTH_FAILURE_DELAY_MS`
6. Deploy and verify:
   - `GET /healthz` returns 200
   - all top-level routes load
   - staff key verification fails with delayed error (~500ms)

Render demo/testing note:
- Keep `STAFF_AUTH_DISABLED` unset or `false` for the normal protected deployment.
- Only set `STAFF_AUTH_DISABLED=true` when you intentionally want `/front-desk`, `/race-control`, and `/lap-line-tracker` to open without the staff key gate.
