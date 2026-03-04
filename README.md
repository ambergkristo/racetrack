# Beachside Racetrack

Realtime race management and public display system built with Node.js and Socket.IO.

## What This Project Does

- Runs a realtime racetrack operations system with multiple UIs:
  - `/front-desk`
  - `/race-control`
  - `/lap-line-tracker`
  - `/leader-board`
  - `/next-race`
  - `/race-countdown`
  - `/race-flags`
- Uses Socket.IO for live updates (no polling for live state updates).
- Uses server-authoritative race state and timer.
- Enforces staff route access keys before socket connection.

## Timer Modes

- `npm run dev` => 1 minute race timer
- `npm start` => 10 minute race timer

## Project Stages

### MVP
- In-memory authoritative state
- Random/auto car assignment
- No persistence across restart

### Upgrade (Feature-Flagged)
- Persistence across restart
- Admin manual car selection
- Default behavior remains unchanged when flags are OFF

## Team

4 developers.
Mentor is advisory/review only and not a task owner.
