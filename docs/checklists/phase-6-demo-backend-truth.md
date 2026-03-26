# Phase 6 Demo Backend Truth Checklist

Use this as backend truth input for Dev D release prep and as the fallback explainer during demo dry runs.

## Evidence Inputs

- Phase 2 branch: `feat/phase-2-devA-truth-ui-support`
- Phase 2 commit: `5ed3572f2398107654240053500900ac275c4afe`
- Phase 3 branch: `feat/phase-3-devA-queue-truth`
- Phase 3 commit: `3e7886a700ea8958698c51ba2268da31349097b6`
- Phase 4 branch: `feat/phase-4-devA-state-clarity-support`
- Phase 4 commit: `bb5e2865ef46d2169f308ec60453af689e41a7da`
- Phase 5 branch evidence: not present locally at authoring time, treat as external dependency before final demo sign-off

## Demo Truth Quick Answers

### 1. Lifecycle State Meaning

- `RUNNING`
  - Race is live.
  - Lap input is accepted.
  - Display flag comes from race mode (`SAFE`, `HAZARD_SLOW`, `HAZARD_STOP`).
- `FINISHED`
  - Finish has been called.
  - Checkered meaning applies.
  - Post-finish laps still count until lock.
  - Results are not final yet.
- `LOCKED`
  - Race is finalized.
  - Lap input is blocked.
  - Results are final.
  - Locked is not the same thing as checkered; it is the finalized state after checkered flow is closed.

### 2. Backend Fields To Quote During Demo

- For state clarity, quote:
  - `state`
  - `flag`
  - `lapEntryAllowed`
  - `resultsFinalized`
  - `stateLabel`
  - `stateDescription`
- For queue clarity, quote:
  - `currentSessionId`
  - `nextSessionId`
  - `queuedSessionIds`
- For manual assignment, quote:
  - racer `carNumber`
  - unchanged queue truth fields before and after assignment

### 3. Queue Truth

- `current` is the active staged/running session.
- `next` is the first queued session after `current`.
- `queued` is the ordered remainder of the queue after `current`.
- Manual car assignment must not change queue order or queue truth.

## Release Checklist Input For Dev D

- Verify `FINISHED` and `LOCKED` separately.
- Verify post-finish lap is accepted before lock.
- Verify post-lock lap is rejected with `LAP_INPUT_BLOCKED`.
- Verify queue truth is explicit and not inferred in UI:
  - `currentSessionId`
  - `nextSessionId`
  - `queuedSessionIds`
- Verify manual car assignment changes racer data only, not queue order.
- If any of the above cannot be demonstrated from route payloads or passing tests, mark demo fallback as `NO-GO`.

## Route / Test Verification Pointers

- State clarity route proof:
  - `GET /api/race`
  - expected after finish: `state=FINISHED`, `flag=CHECKERED`, `lapEntryAllowed=true`, `resultsFinalized=false`
  - expected after lock: `state=LOCKED`, `flag=LOCKED`, `lapEntryAllowed=false`, `resultsFinalized=true`
- State clarity tests:
  - `derived state truth keeps FINISHED distinct from LOCKED`
  - `race flow broadcasts canonical snapshots, timer finish, and lock guards`
- Queue/manual assignment tests:
  - `queue truth and session guards stay deterministic for front-desk workflow`
  - `manual car assignment flag does not change queue ordering truth`

## Dry Run Record

- Dry run 1: PASS
  - branch: `feat/phase-3-devA-queue-truth`
  - command: `npm test`
  - purpose: queue truth + manual assignment truth review
- Dry run 2: PASS
  - branch: `feat/phase-4-devA-state-clarity-support`
  - command: `npm test`
  - purpose: FINISHED vs LOCKED clarity review

## Demo Fallback Rule

- Do not invent new explanation logic live.
- If a demo question appears, answer from backend payload or named test evidence only.
- If the payload or passing test cannot explain the state immediately, mark it as a demo risk and stop the flow instead of changing lifecycle truth.
