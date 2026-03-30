# Phase 6 Demo Readiness Evidence
## Status
ACTIVE

## Current Verdict
READY FOR DRY RUN

## Scope outcome
- Dev B Phase 6 operator demo flow is now explicitly locked for `/front-desk`, `/race-control`, and `/lap-line-tracker`.
- This evidence confirms route order, operator responsibilities, fallback awareness, and route-level proof.
- This evidence does not claim final Phase 6 `PASS` before the required dry runs and integration-branch gate exist.

## Start-condition proof already available
- Front-desk PASS proof: `Sources/Developers/Dev-B-Kristo-Leier/27.03-SPRINT/01-PHASE-2-P0-UX-CORRECTION-EVIDENCE.md`
- Race-control PASS proof: `Sources/Developers/Dev-B-Kristo-Leier/27.03-SPRINT/03-PHASE-4-RACE-CONTROL-CLARITY-EVIDENCE.md`
- Dev C public coherence input: `docs/handoffs/dev-c-phase-6-to-dev-b.md` on `origin/feat/phase-6-devC-demo-stabilization`
- Dev D smoke script: `Sources/Developers/Dev-D-Kevin/27.03-SPRINT/05-PHASE-6-SMOKE-SCRIPT.md` on `origin/feat/phase-6-devD-readiness-package`
- Dev D fallback note: `Sources/Developers/Dev-D-Kevin/27.03-SPRINT/05-PHASE-6-BROKEN-MAIN-FALLBACK.md` on `origin/feat/phase-6-devD-readiness-package`

## Front-desk demo flow
1. Open `/front-desk`.
2. Verify that `Current Race`, `Next Race Setup`, and `Saved Sessions` are all visible in one scan.
3. Point out current / next / queued separation using the existing queue workflow blocks, not ad-hoc explanation.
4. Confirm that racer management follows the selected next session without hiding the saved-session list.
5. If manual assignment is enabled, treat it as a bounded helper inside the front-desk flow; if the flag is off, do not introduce it during the demo.
6. Do not edit or restage the active session once the live race path has moved into race-control.
7. Hand off to `/race-control` only after the next race is visibly staged and the queue story is already understandable on its own.

## Race-control operator flow
1. Move to `/race-control` only after the front-desk queue is clearly staged.
2. Confirm the authoritative state line before any action.
3. Run the canonical operator order only:
   - `Start`
   - live race monitoring
   - `Finish`
   - one post-finish lap acceptance proof
   - `End + Lock`
4. Do not present `Finish` and `Lock` as interchangeable.
5. Do not use mode changes outside the allowed running window.
6. If a verbal explanation is needed, keep it limited to the current state and next action already shown in the route.

## Lap-tracker role during demo
- Dev B owns `/lap-line-tracker` input during the live run.
- Lap entry is only used while the race is `RUNNING` or `FINISHED`.
- After `LOCKED`, no lap entry rescue is allowed.
- If lap tracking fails, use Dev D's fallback: keep truth on `/race-control` and `/leader-board`.

## Operator ownership for live demo
- Dev B owns the staff-side story for `/front-desk` and `/race-control`.
- Dev B is the named lap-tracker input owner during the live run.
- Public-route commentary should defer to Dev C route coherence and Dev D fallback, not replace staff truth.

## Route verification
- `node tests/front-desk-workflow.ui.test.js` - PASS
- `node tests/race-control-clarity.ui.test.js` - PASS
- `node tests/race-control-regression.integration.test.js` - PASS
- `node tests/race-flow.integration.test.js` - PASS

## Route verification detail
- `/front-desk`
  - Current / next / queued workflow blocks render together.
  - Manual assignment messaging stays hidden with flag OFF and bounded with flag ON.
  - Saved sessions remain visible while racer management follows the selected next session.
- `/race-control`
  - Mode controls are hidden outside `RUNNING`.
  - `FINISHED` remains visibly distinct from `LOCKED`.
  - `Start`, `Finish`, and `End + Lock` remain separate operator actions.
- `/lap-line-tracker`
  - Lap entry is accepted while `RUNNING`.
  - Post-finish lap entry remains valid while `FINISHED`.
  - Lap entry is blocked after `LOCKED`.

## What proves the operator can run the demo without explanation
- `/front-desk` already shows current / next / queued in one route without a second screen handoff.
- `/race-control` already separates `Start`, `Finish`, and `End + Lock` into distinct operator actions.
- `FINISHED` and `LOCKED` already use distinct locked Phase 4 wording, so checkered flow and finality are not collapsed into one state.
- `/lap-line-tracker` already blocks input after `LOCKED`, which keeps the demo from inventing post-lock truth.

## Screenshot or still references
- Front-desk still: `Sources/Developers/Dev-B-Kristo-Leier/27.03-SPRINT/evidence/front-desk-phase2.png`
- Race-control still, `FINISHED`: `Sources/Developers/Dev-B-Kristo-Leier/27.03-SPRINT/evidence/race-control-phase4-finished.png`
- Race-control still, `LOCKED`: `Sources/Developers/Dev-B-Kristo-Leier/27.03-SPRINT/evidence/race-control-phase4-locked.png`

## Fallback confirmation used by Dev B
- If `/front-desk` fails, continue operator narrative on `/race-control` and stop queue editing.
- If `/lap-line-tracker` fails, stop lap entry and keep truth on `/race-control` plus `/leader-board`.
- If public routes fail, Dev D fallback reduces to `/race-flags` or `/leader-board`; Dev B should not improvise a new staff-side truth source.

## Acceptance-check status
- Front-desk demo flow is uniquely defined: YES
- Race-control operator flow is short and understandable: YES
- Current / next / queued and Finish / Lock are kept distinct in verified route behavior: YES
- Fallback steps are known and documented from Dev D input: YES
- Two dry-run records exist: NO
- Final integrated Phase 6 gate exists: NO

## Still pending before final PASS
- Two dry-run PASS/FAIL records are still required.
- Final integrated gate must still happen on `integration/phase-6-demo-readiness`.
- This file locks Dev B's flow and proof references, but it does not override the repository-level Phase 6 integration rule.
