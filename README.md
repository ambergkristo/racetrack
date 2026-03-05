# Beachside Racetrack - M0 Skeleton

Single-host M0 setup:
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
- Polling for live updates is not allowed.
- REST is used only for handshake/health style calls:
  - `GET /healthz`
  - `GET /api/bootstrap`
  - `POST /api/auth/verify`

## Required Environment Variables

These keys are required at startup (fail-fast if missing):
- `FRONT_DESK_KEY`
- `RACE_CONTROL_KEY`
- `LAP_LINE_TRACKER_KEY`

Other env vars:
- `PORT` (default `3000`)
- `RACE_DURATION_SECONDS` (optional explicit override)

Timer defaults:
- `npm run dev` => 60 seconds
- `npm start` => 600 seconds

## Local Run

1. Copy env file:
   - `cp .env.example .env` (or create `.env` manually on Windows)
2. Install dependencies:
   - `npm ci`
3. Build frontend assets:
   - `npm run build`
4. Start production mode:
   - `npm start`

Development mode:
- `npm run dev`

## Health Check

- `GET /healthz` returns HTTP 200 and runtime metadata.

## Deployed URL + Routes Template

Base URL:
- `https://<your-render-service>.onrender.com`

Route URLs:
- `https://<your-render-service>.onrender.com/front-desk`
- `https://<your-render-service>.onrender.com/race-control`
- `https://<your-render-service>.onrender.com/lap-line-tracker`
- `https://<your-render-service>.onrender.com/leader-board`
- `https://<your-render-service>.onrender.com/next-race`
- `https://<your-render-service>.onrender.com/race-countdown`
- `https://<your-render-service>.onrender.com/race-flags`

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
   - optional `RACE_DURATION_SECONDS`
6. Deploy and verify:
   - `GET /healthz` returns 200
   - all top-level routes load
   - staff key verification fails with delayed error (~500ms)
