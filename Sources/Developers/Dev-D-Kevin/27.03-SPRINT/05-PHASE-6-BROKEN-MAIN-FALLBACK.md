# Phase 6 Broken-Main Fallback
## Rule
Fallback may reduce the visible route set, but it may not invent or mutate truth outside the canonical controls already covered by tests.

## Broken-main fallback
1. Stop calling the build ready for merge.
2. Keep `main` as the truth baseline reference only; do not patch live during the demo.
3. Switch the live walkthrough to the last known passing local checkout built from `origin/main`.
4. Re-run the short smoke path:
   - `npm run lint`
   - `node tests/socket-smoke.test.js`
   - `node tests/race-flow.integration.test.js`
   - `npm run build`
5. If any command fails, Phase 6 readiness stays `FAIL`.

## Route-failure fallback
1. If `/front-desk` fails, keep operator narrative on `/race-control` and do not continue queue editing.
2. If `/lap-line-tracker` fails, stop lap entry and keep truth on `/race-control` plus `/leader-board`.
3. If `/leader-board`, `/next-race`, or `/race-countdown` fails, fall back to `/race-flags`.
4. If `/race-flags` fails, fall back to `/leader-board`.
5. If both `/leader-board` and `/race-flags` fail, stop the public demo path and mark the run `FAIL`.

## Truth-preservation constraints
- Never skip directly from `STAGING` to `FINISHED` or `LOCKED`.
- Never use feature-flag toggles as a demo rescue if the baseline was started with different flags.
- Never claim public truth that is not also visible from `race-control`.
- Never mark Phase 6 `PASS` without an integration-branch PASS per `Sources/Developers/27.03-SPRINT-INTEGRATION-STATUTE.md`.
