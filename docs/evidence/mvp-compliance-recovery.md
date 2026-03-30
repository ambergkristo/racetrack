# MVP Compliance Recovery

This note records the missing school-assignment MVP requirements that were still not satisfied, where they were implemented, and how the recovered behavior now matches the original brief.

## 1. Automatic car assignment

- Requirement:
  - The system must expose an authoritative 8-car pool.
  - Cars must be assigned automatically when racers are added.
  - A single session cannot contain duplicate car assignments.
  - `next-race` must show queued racers together with their assigned cars.
- Implemented in:
  - `src/domain/raceStore.js`
  - `server.js`
  - `client/app.js`
  - `client/app.css`
  - `tests/race-store.test.js`
  - `tests/session-racer-crud.integration.test.js`
  - `tests/realtime-contract.integration.test.js`
- What changed:
  - Added an authoritative 8-car pool (`1`-`8`) in the race store.
  - Racer creation now auto-assigns the next available car by default.
  - Duplicate car numbers are blocked within the same session.
  - Manual car assignment remains available only when `FF_MANUAL_CAR_ASSIGNMENT` is enabled.
  - Front Desk default UI now explains auto-assignment instead of relying on manual car-number entry.
  - `next-race` continues to render racer/car pairings from authoritative session truth.
- Compliance result:
  - MVP-default behavior now matches the assignment requirement: cars are assigned automatically, remain unique within a session, and are shown consistently across staff/public routes.

## 2. Race flags visual compliance

- Requirement:
  - `SAFE` => vibrant green
  - `HAZARD_SLOW` => solid yellow
  - `HAZARD_STOP` => solid red
  - `FINISHED` => checkered black/white
  - The route must read as a fullscreen-first flag display, not a small status widget.
- Implemented in:
  - `client/app.js`
  - `client/app.css`
- What changed:
  - `race-flags` now maps authoritative flag truth to explicit visual classes.
  - The flag board uses strong fullscreen-first backgrounds for safe, slow, stop, and checkered states.
  - A large visible label was added so the mode is legible at distance.
- Compliance result:
  - Race-control mode changes now propagate to a visually compliant public flag board with clear state color and large labeling.

## 3. Session end flow compliance

- Requirement:
  - After `FINISHED`, the safety officer can end the session.
  - The next session must be brought into focus.
  - Race mode must become `HAZARD`.
  - `next-race` must show the finished session racers with a pit-lane instruction.
- Implemented in:
  - `src/domain/raceStore.js`
  - `server.js`
  - `src/ui/raceTruth.js`
  - `src/persistence/raceStatePersistence.js`
  - `client/app.js`
  - `client/app.css`
  - `tests/realtime-contract.integration.test.js`
  - `tests/persistence-recovery.integration.test.js`
- What changed:
  - Lock/session-end flow now advances the queued next session into active focus for the safety officer.
  - The finished session is retained as `lockedSession` together with final results.
  - Post-finish race mode now moves to `HAZARD_STOP`, matching the assignment’s danger-state expectation after the session is ended.
  - `next-race` now shows the just-finished session as a pit-lane handoff view while the next session remains queued in focus.
  - Locked-session display context persists until the next safe start, including across restart.
  - The lap tracker visual now includes a pit-lane marker for the post-finish flow.
- Compliance result:
  - The system now distinguishes running finish state from later session-ended state, keeps the pit instruction visible, and brings the next session forward without losing previous-session context too early.

## 4. Leaderboard compliance

- Requirement:
  - Show current race racers and cars.
  - Sort by authoritative best lap.
  - Show timer, flag, best lap, and current lap.
  - Keep previous session results visible until the next session starts safely.
- Implemented in:
  - `src/ui/raceTruth.js`
  - `server.js`
  - `client/app.js`
  - `src/persistence/raceStatePersistence.js`
- What changed:
  - Leaderboard display now prefers held final results outside running mode until the next safe start clears them.
  - Locked session and final results are preserved through staging/idle and through persistence recovery.
  - Current lap, best lap, timer, and flag remain derived from existing authoritative live race truth.
- Compliance result:
  - The leaderboard remains authoritative during a race and continues to show the last completed results until the next session is started safely, matching the assignment requirement.

## Validation summary

- `npm run lint`
- `npm test`
- `npm run build`
- `npm run test:m3-matrix`

All required checks pass on the recovery branch after the compliance changes above.
