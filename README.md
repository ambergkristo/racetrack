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

## UI system & route map

The UI follows a shared React design system used on every route.

Design tokens:
- background: `#0b0b0f`
- panel: `#16161c`
- safe: `#00ff7b`
- warning: `#ffd400`
- danger: `#ff2e2e`
- finished: checkered pattern
- fonts: `Orbitron` (headings), `Rajdhani` (UI/body)
- touch targets:
  - staff buttons min `56px`
  - lap car buttons `120-160px`

Shared components:
- `AppShell`, `Panel`, `TelemetryHeader`, `KpiPill`
- `Button` variants (`Primary`, `Danger`, `Warning`, `Ghost`, `HugeTouch`)
- `FullscreenButton`, `ConnectionStatus`, `Toast/InlineAlert`
- `LoadingSkeleton`, `EmptyState`, `Divider/Table`

Staff gate:
- `KeyGateModal(routeKeyName)` is required on staff routes before any Socket.IO connection.
- Wrong key responses must honor server-side delayed failure behavior (500ms).

Route map:
- `/leader-board`: `LeaderboardScreen`, `LeaderboardTable/Row`, `FlagStatusBar`, `FullscreenButton`
- `/race-flags`: `RaceFlagsScreen`, `FlagFullScreen(mode)`, `FullscreenButton`
- `/race-countdown`: `CountdownScreen`, `CountdownTimerBig`, `NextRaceRoster`, `SessionStatusBanner`
- `/next-race`: `NextRaceScreen`, `NextRaceTable`, `CallToPitBanner`, `FullscreenButton`
- `/race-control`: `RaceControlScreen`, `ModeSelector`, `Start/Finish/EndLock` actions + guards
- `/lap-line-tracker`: `LapTrackerScreen`, `CarGrid`, `CarButtonHuge`, `SessionEndedOverlay`
- `/front-desk`: `FrontDeskScreen`, `SessionsList`, `SessionEditor`, `RacerList CRUD`
- Upgrade-only in `/front-desk`: `ManualCarAssignmentPanel` behind `FF_MANUAL_CAR_ASSIGNMENT`

## How to run + env keys

Required environment keys:
- `FRONT_DESK_KEY`
- `RACE_CONTROL_KEY`
- `LAP_LINE_TRACKER_KEY`

Server behavior:
- Server must not start if required staff keys are missing.
- In dev mode (`npm run dev`) race timer is 1 minute.
- In start mode (`npm start`) race timer is 10 minutes.

Run commands:
1. Install dependencies:
   - `npm install`
2. Start in development mode:
   - `npm run dev`
3. Start in default mode:
   - `npm start`

Realtime rule:
- Do not use polling for live state updates.
- Only initial bootstrap/handshake may use API fetch; all live updates must use Socket.IO.
