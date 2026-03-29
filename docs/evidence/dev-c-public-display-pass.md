# Dev C Public Display Pass

- verdict: MOSTLY DONE, PROOF MISSING

## Audited public routes

- `/leader-board`
- `/next-race`
- `/race-countdown`
- `/race-flags`

## Strongest evidence paths

- `client/app.js`
  - route registry for all four public routes exists at the top-level route map
  - shared public-display shell functions exist as `appShell`, `panel`, `telemetryHeader`, and `fullscreenButton`
  - public routes render through dedicated functions: `leaderBoardPanels`, `nextRacePanels`, `countdownPanels`, `flagPanels`
  - websocket-only live updates are wired through `window.io(...)` plus `race:snapshot`, `leaderboard:update`, and `race:tick`
- `client/app.css`
  - shared public-display baseline exists through `.public-shell`, `.public-route-grid`, `.fullscreen-btn`, and route-specific public layout blocks
  - the public routes share one presentation-oriented shell rather than separate ad hoc pages
- `server.js`
  - canonical public routes are explicitly registered in `PUBLIC_ROUTES`
  - Socket.IO transport is locked to `["websocket"]`, which is direct evidence that polling is not the live-update model
- `src/domain/raceStateMachine.js`
  - actual implementation state/mode truth exists as `RACE_STATES` and `RACE_MODES`
- `src/ui/raceTruth.js`
  - user-facing state labels and descriptions are derived from canonical race truth

## Primary proof route

- `/leader-board`

Why this is the best proof route:

- it is clearly a real public display, not a placeholder
- it combines fullscreen support, websocket live state, public-shell styling, live leaderboard data, and explicit state/flag language in one route
- it is the easiest single route to defend as “first usable public display pass is already done”

## Fullscreen evidence

- Shared fullscreen affordance is implemented in `client/app.js` via `fullscreenButton()` and rendered for `routeConfig.public`
- Fullscreen toggle handling is implemented in `client/app.js` through `data-action="toggle-fullscreen"` and `document.documentElement.requestFullscreen(...)`
- Public fullscreen styling is implemented in `client/app.css` under `.public-shell.is-fullscreen`
- Screenshot artifact generated from the primary proof route:
  - `docs/evidence/screenshots/dev-c-public-route-proof.png`

## Realtime / no-polling evidence

- `server.js` sets `SOCKET_TRANSPORTS = ["websocket"]`
- `client/app.js` opens realtime with `window.io({ transports: ["websocket"] ... })`
- `client/app.js` listens to canonical websocket events:
  - `race:snapshot`
  - `leaderboard:update`
  - `race:tick`
- `README.md` explicitly documents:
  - “Realtime updates use Socket.IO.”
  - “Polling for live updates is not allowed (Socket.IO is configured for `websocket` only).”

## Shared UI / public display baseline

Expected names were `AppShell`, `Panel`, `TelemetryHeader`, `FullscreenButton`.

Actual implementation uses the same concepts as lowercase shared functions and shell classes:

- `appShell(...)`
- `panel(...)`
- `telemetryHeader()`
- `fullscreenButton()`
- `.public-shell`
- `.public-route-grid`

This is sufficient evidence that the public display baseline exists, even though the naming differs from the expectation.

## Route verification

- Route: `/leader-board`
- Purpose: Public timing tower for guests and racers, focused on live order, best lap, countdown, and race state.
- UI/components:
  - shared shell: `appShell`, `panel`, `telemetryHeader`
  - public route status shell: `publicStatusPanel`
  - primary route renderer: `leaderBoardPanels`
  - route-specific CSS: `.route-leader-board`, `.leaderboard-panel`, `.leaderboard-top-strip`, `.leaderboard-table-shell`, `.leaderboard-scroll`
- Fullscreen support:
  - yes
  - shared `fullscreenButton()` is rendered on public routes
  - public fullscreen styling is present
- Realtime model:
  - websocket-driven canonical race snapshot and leaderboard updates
  - route consumes shared `state.raceSnapshot` and display leaderboard derivation
- Polling used?: no
- State language used:
  - actual state truth from `src/domain/raceStateMachine.js`:
    - `RaceState = IDLE | STAGING | RUNNING | FINISHED | LOCKED`
    - `RaceMode = SAFE | HAZARD_SLOW | HAZARD_STOP`
  - public-facing flag/state language from `client/app.js` and `src/ui/raceTruth.js`:
    - `Flag = IDLE | STAGING | SAFE | HAZARD_SLOW | HAZARD_STOP | CHECKERED | LOCKED`
    - labels/descriptions shown as `Idle`, `Staging`, `Running`, `Finished`, `Locked`, `Safe`, `Hazard Slow`, `Hazard Stop`, `Checkered`, `Locked`
- Evidence files:
  - `client/app.js`
  - `client/app.css`
  - `server.js`
  - `src/domain/raceStateMachine.js`
  - `src/ui/raceTruth.js`
  - `README.md`
  - `docs/evidence/screenshots/dev-c-public-route-proof.png`

## What this proves

Dev C’s first usable public display pass is already implemented in the repo. All four required public routes exist, they run on a shared public-display shell, fullscreen support exists, and live updates are websocket-driven rather than polling-based. The strongest single proof route is `/leader-board`, which already demonstrates usable public-display responsibility with real state language and live race data. The missing gap was mainly a clean evidence artifact, not the implementation itself.
