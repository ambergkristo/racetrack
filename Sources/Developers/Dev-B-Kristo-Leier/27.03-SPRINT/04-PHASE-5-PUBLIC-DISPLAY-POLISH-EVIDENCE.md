# Phase 5 Public Display Polish Evidence
## Status
PASS

## Start condition proof used
- `docs/evidence/dev-c-public-display-pass.md`
- `docs/evidence/screenshots/dev-c-public-route-proof.png`

## Semantics audit summary
- Staff and public routes still share the locked Phase 4 state language for `FINISHED` and `LOCKED`.
- Public `leader-board`, `race-countdown`, and `race-flags` continue to mirror race-control truth without redefining finish or lock semantics.
- The one public wording issue was on `/next-race`, where staff-oriented queue language leaked into guest-facing copy.

## Minimal semantic corrections for Dev C
- Route: `/next-race`
- Previous text: `Next queued lineup waiting for handoff.`
- Expected public text: `Next lineup waiting to take the track.`

- Route: `/next-race`
- Previous text: `Queue is empty`
- Expected public text: `Next lineup not ready`

- Route: `/next-race`
- Previous text: `Add and queue the next session from front desk.`
- Expected public text: `Front desk has not staged the next lineup yet.`

## Verification notes
- `FINISHED` stays aligned with the locked Phase 4 wording:
  - `Finish has been called. Post-finish laps are still accepted until lock.`
- `LOCKED` stays aligned with the locked Phase 4 wording:
  - `Race is locked. Results are final and lap input is blocked.`
- Manual assignment messaging does not render on the audited public route.
- Public wording now stays presentation-first and avoids exposing staff queue terminology.

## Verification references
- `client/app.js`
- `src/ui/raceTruth.js`
- `tests/phase4-public-state-language.ui.test.js`
- `tests/phase4-race-control-parity.ui.test.js`
- `tests/phase5-public-display-polish.ui.test.js`

## PASS marker
PASS: public display semantics stay aligned with race-control truth after removing queue-language leakage from `/next-race`.
