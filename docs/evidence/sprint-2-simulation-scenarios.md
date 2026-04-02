# Sprint 2 Simulation Scenarios

## Scenario Sequence

- Sprint 2 continues on top of the Sprint 1 telemetry track foundation instead of rebuilding the track panel.
- When simulation starts, the backend now precomputes a deterministic scenario plan in `src/domain/raceStore.js`.
- The plan always starts in `SAFE_RUN`, schedules one hazard window during the run, optionally inserts a brief `HAZARD_STOP`, returns through `RECOVERY`, and then waits for the lap target to trigger `CHECKERED`.
- After the finish queue drains, the simulation transitions into `PIT_RETURN` and only becomes `COMPLETED` after every car has cleared the pit lane.

## Flag Changes

- Public flag truth still comes from canonical race state, but simulation phase now drives mode changes while the simulated race is active.
- `SAFE_RUN` and `RECOVERY` keep the public flag at `SAFE`.
- `HAZARD_SLOW` switches the race mode to `HAZARD_SLOW`.
- `HAZARD_STOP` switches the race mode to `HAZARD_STOP`.
- Reaching the lap target calls the normal finish flow, which moves the race into `FINISHED` and exposes `CHECKERED`.
- Locking after pit return moves the public truth into `LOCKED` while preserving the completed simulation snapshot for downstream views.

## Pit Return

- The pit lane from Sprint 1 is now used as an actual return route instead of a static visual accent.
- After checkered, racers are released into pit return in finish order with a small stagger so they do not disappear instantly.
- Each racer keeps authoritative `lane`, `pitProgress`, `pitDurationMs`, and `pitReleaseAtMs` state on the backend.
- The client renders `TRACK`, `PIT`, and `GARAGE` marker lanes separately so cars visibly peel off the main loop, travel through the pit path, and settle off-track.

## Session Progression

- Simulation no longer dead-ends after the final lap.
- Once all racers complete pit return, the backend completes the simulation with reason `pit_return_complete` and performs the normal lock transition.
- That lock preserves the finished session as `lockedSession`, keeps final order available, and advances the active session pointer to the next queued session when one exists.
- This keeps the next session visible and ready without breaking the existing session-state truth model.

## Synced Screens And Routes

- `lap-line-tracker` now shows simulation phase messaging, pit-return-aware track markers, and the same shared phase truth as the backend.
- `race-control` now surfaces the live simulation scenario phase in the control console status area.
- `race-flags` and `leader-board` receive the same canonical `SAFE`, `HAZARD_SLOW`, `HAZARD_STOP`, `CHECKERED`, and `LOCKED` truth through the existing snapshot contract.
- `next-race` now shows pit-return guidance and keeps the next lineup visible while the finished field clears the pit lane.
- The websocket snapshot contract and persisted race state were extended so reconnects and restarts retain the same simulation truth safely.

## Sprint 2 Scope Kept Out

- No broad redesign of the telemetry map beyond what pit-return routing required.
- No physics-style motion system.
- No extra scenario types beyond the bounded safe / hazard / finish / pit-return flow.
- No unrelated page redesign outside the already affected simulation-linked views.

## Validation Results

- `npm run lint` passed.
- `npm test` passed.
- `npm run build` passed.
- Regression coverage now checks scenario-aware store behavior, websocket truth during simulation, and public next-race pit-return guidance.
