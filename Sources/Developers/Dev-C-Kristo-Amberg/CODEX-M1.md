# CODEX MASTERPROMPT — M1 (Dev C)

DEC: Dev C (Kristo Amberg, Lead)  
REPO: https://github.com/ambergkristo/racetrack  
MILESTONE: M1 (Public UI MVP flow + lead governance)  
BASE BRANCH: main (read-only)  
WORKING BRANCH: feat/m1-devC-public-mvp-flow

## Mission (M1 / Dev C scope)
Deliver public-screen MVP experiences and maintain lead governance:
- `/leader-board`, `/next-race`, `/race-countdown`, `/race-flags`
- keep shared UI primitives coherent across routes
- preserve no-polling, socket-first architecture

## Non-goals (M1)
- No backend ownership work (Dev A)
- No socket contract ownership work (Dev D)
- No staff UI ownership (Dev B) except shared primitives coordination

## Branch workflow
1) git checkout main && git pull
2) git checkout -b feat/m1-devC-public-mvp-flow
3) implement
4) run tests/lint/build locally
5) commit: "M1: public MVP route flow and shared UI cohesion (Dev C)"
6) push + open PR -> main

## UI/UX integration (M1 — required)
- Apply AppShell/Panel/TelemetryHeader consistently.
- Ensure public routes are fullscreen-friendly.
- Keep dashboard visual consistency and readability.
- Coordinate with Dev B on shared component boundaries.

## Hard requirements
- Public routes rely on realtime socket updates (no polling).
- Preserve route-level deep-link behavior.
- Maintain lead quality gate before merge.

## Deliverable / DoD (M1 for Dev C)
- Public routes render live MVP state paths.
- Shared primitives are reused (no duplicated design system forks).
- Fullscreen UX baseline is functional and stable.
- CI passes.

## PR checklist
- [ ] Public routes use shared primitives
- [ ] No polling added
- [ ] UX consistency maintained
- [ ] PR title contains "M1"
