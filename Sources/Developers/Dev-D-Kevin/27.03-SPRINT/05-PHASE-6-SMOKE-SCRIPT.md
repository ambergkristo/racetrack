# Phase 6 Smoke Script
## Purpose
Short 5-7 minute demo path that stays on the tested route surface and preserves the truth baseline.

## Preconditions
- Start from current `main` baseline.
- Confirm build health first:
  - `npm run lint`
  - `npm test`
  - `npm run build`
- Keep one operator on staff routes and one observer on public routes.
- Do not improvise new flow outside the routes listed below.

## Demo route order
1. `/front-desk`
   - Show current / next / queued separation.
   - Show that manual assignment stays flag-bound, not truth-bound.
   - Test coverage: `tests/front-desk-workflow.ui.test.js`, `tests/front-desk-feature-flag.ui.test.js`, `tests/session-racer-crud.integration.test.js`.
2. `/race-control`
   - Show authoritative state line and command surface.
   - Drive `STAGING -> RUNNING -> FINISHED -> LOCKED` only in canonical order.
   - Test coverage: `tests/race-control-clarity.ui.test.js`, `tests/race-control-regression.integration.test.js`.
3. `/lap-line-tracker`
   - Enter lap events only while the race is active.
   - Stop once checkered/locked truth is visible.
   - Test coverage: `tests/staff-route-ux.ui.test.js`, `tests/race-flow.integration.test.js`.
4. `/leader-board`
   - Show live order and state wording.
   - Keep this as the default public fallback route.
   - Test coverage: `tests/phase2-public-truth-regression.ui.test.js`, `tests/phase4-public-state-language.ui.test.js`, `tests/socket-smoke.test.js`.
5. `/next-race`
   - Show upcoming session and top-three shell if data exists.
   - Keep explanation minimal; route should read on its own.
6. `/race-countdown`
   - Show pre-start or in-progress timing state only if it matches staff truth.
7. `/race-flags`
   - End on the simplest public truth board if any richer public route becomes unstable.

## PASS conditions
- Staff routes and public routes tell the same state story.
- No route requires explanation that contradicts `race-control`.
- No state jump skips canonical order.
- Public fallback can be reduced to `/leader-board` or `/race-flags` without inventing new truth.

## FAIL conditions
- A route disagrees with `race-control` truth.
- Operator must leave the script to recover the demo.
- A route needs hidden manual repair during the run.
- No integration branch PASS exists for the full Phase 6 gate.
