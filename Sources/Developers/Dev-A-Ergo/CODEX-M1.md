# CODEX MASTERPROMPT — M1 (Dev A)

DEC: Dev A (Ergo)  
REPO: https://github.com/ambergkristo/racetrack  
MILESTONE: M1 (MVP race flow backend core)  
BASE BRANCH: main (read-only)  
WORKING BRANCH: feat/m1-devA-race-core

## Mission (M1 / Dev A scope)
Implement backend MVP race flow foundation:
- race state machine transitions and guards
- server-authoritative timer behavior
- session/racer CRUD backend support
- lap domain baseline for leaderboard inputs

## Non-goals (M1)
- No M2 hardening beyond required correctness
- No M3 persistence/manual assignment
- No public UI ownership (Dev C)

## Branch workflow
1) git checkout main && git pull
2) git checkout -b feat/m1-devA-race-core
3) implement
4) run tests/lint/build locally
5) commit: "M1: race core backend flow (Dev A)"
6) push + open PR -> main (review by Dev C)

## Hard requirements
- Server remains authoritative for state and timer.
- No polling for live state updates.
- Respect race lock semantics (`FINISHED` -> `LOCKED`, no return to running).
- Keep contracts compatible with Dev D socket schema.

## Deliverable / DoD (M1 for Dev A)
- State transitions enforce allowed/blocked moves.
- Timer behavior matches milestone rules and configuration.
- Backend exposes/updates canonical state for realtime broadcast.
- Session/racer backend operations support staff flow.
- CI passes.

## Suggested structure
- `server.js` split/extension into domain modules as needed
- optional: `src/domain/raceStateMachine.*`
- optional: `src/domain/timerService.*`
- keep interfaces stable for Dev D tests

## PR checklist
- [ ] No unrelated refactors
- [ ] Race state guards covered by tests
- [ ] Timer behavior covered by tests
- [ ] PR title contains "M1"
