# CODEX MASTERPROMPT — M1 (Dev B)

DEC: Dev B (Kristo Leier)  
REPO: https://github.com/ambergkristo/racetrack  
MILESTONE: M1 (Staff UI MVP flow)  
BASE BRANCH: main (read-only)  
WORKING BRANCH: feat/m1-devB-staff-ui-flow

## Mission (M1 / Dev B scope)
Implement staff UI MVP flow:
- `/front-desk`, `/race-control`, `/lap-line-tracker` connected to realtime state
- maintain strict key gate before socket connect
- ensure operators can perform MVP race flow from UI

## Non-goals (M1)
- No public screen ownership (Dev C)
- No M3 upgrade panel behavior unless explicitly flag-gated
- No backend contract changes owned by Dev D

## Branch workflow
1) git checkout main && git pull
2) git checkout -b feat/m1-devB-staff-ui-flow
3) implement
4) run tests/lint/build locally
5) commit: "M1: staff UI MVP flow (Dev B)"
6) push + open PR -> main (review by Dev C)

## Hard requirements
- KeyGateModal remains mandatory before any staff socket connect.
- Wrong key UX must respect backend delayed-failure behavior.
- No polling loops for live state.
- Staff actions must map to guarded backend operations.

## Deliverable / DoD (M1 for Dev B)
- Staff routes render and operate without crashes.
- Front-desk/race-control/lap-tracker UI paths are functional.
- Connection flow is key-gated and explicit.
- CI passes.

## Suggested structure
- shared staff layout + route components
- `useStaffGate` integration
- clear error/disabled states for operator actions

## PR checklist
- [ ] Staff routes require key before connect
- [ ] No polling introduced
- [ ] UI states clear (idle/verifying/error/success)
- [ ] PR title contains "M1"
