# Phase 6 Regression Recovery

## What broke in Phase 6
- Public display routes picked up harmful layout polish that stole usable viewport space and made the boards feel visually broken.
- Shared route panel sizing stretched heading/content rows incorrectly, creating large dead areas on public boards and race-control.
- Front desk allowed duplicate car numbers inside the same session, which breaks the session truth model.

## What was reverted
- Restored `client/app.js` and `client/app.css` to the last known-good Phase 5 UI baseline as the recovery reference.
- Removed the harmful Phase 6 public layout behavior by rebuilding from the recovered Phase 5 client baseline instead of keeping the broken polish layer.

## What was fixed
- Added targeted grid row sizing so public display panels and the race-control console use `auto + 1fr` height allocation instead of stretching into blank space.
- Restored usable one-screen rendering for:
  - control hub
  - `/front-desk`
  - `/race-control`
  - `/lap-line-tracker`
  - `/leader-board`
  - `/next-race`
  - `/race-countdown`
  - `/race-flags`
- Enforced unique car numbers within a session in both domain logic and front-desk UI feedback.

## Safe Phase 6 changes kept
- None of the harmful public-layout polish was kept.
- The only net-new behavior retained beyond the Phase 5 UI baseline is the duplicate-car-number protection because it is a real validation fix and does not widen product scope.

## Validation summary
- `npm run lint`: PASS
- `npm test`: PASS
- `npm run build`: PASS
- `npm run test:m3-matrix`: PASS
- Manual desktop verification at `1920x1080` after rebuild:
  - control hub no longer showed unnecessary page-spilling layout
  - front desk kept create-session controls visible
  - lap line tracker content remained vertically visible
  - public display routes rendered without the Phase 6 layout damage
  - race-control returned to a compact console layout
