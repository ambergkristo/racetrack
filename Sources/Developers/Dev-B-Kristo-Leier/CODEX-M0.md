# CODEX MASTERPROMPT — M0 (Dev B)

DEC: Dev B (Kristo Leier)  
REPO: https://github.com/ambergkristo/racetrack  
MILESTONE: M0 (Foundation + route skeletons + staff gate UX)  
BASE BRANCH: main (read-only)  
WORKING BRANCH: feat/m0-devB-staff-gate

## Mission (M0 / Dev B scope)
Build Staff route gating UX that blocks Socket.IO connection until key is verified.
Staff routes:
- /front-desk
- /race-control
- /lap-line-tracker

M0 deliverable: routes open, skeleton UI renders, staff key modal appears before any socket connect.

## Non-goals (M0)
- No real CRUD yet beyond skeleton
- No domain/race logic
- No public display work (Dev C)

## Branch workflow
1) git checkout main && git pull
2) git checkout -b feat/m0-devB-staff-gate
3) implement
4) run tests/lint/build locally
5) commit: "M0: staff key gate modal + skeleton routes (Dev B)"
6) push + open PR -> main (review by Dev C)

## Hard requirements
- Staff route must show KeyGateModal BEFORE any Socket.IO connect attempt.
- If key fails: show error state (and respect ~500ms failure delay behavior from backend).
- After key success: allow socket connection (even if no events yet).
- Shared AppShell/Panel primitives are allowed; do not change global styling beyond what is needed.

## UI/UX constraints (project standard)
- Dark dashboard look, high contrast, large touch targets (public-display friendly).
- Staff gating must be explicit and unskippable.

## Deliverable / DoD (M0 for Dev B)
- /front-desk, /race-control, /lap-line-tracker render without crash.
- KeyGateModal appears on entry and prevents connect until success.
- Connection attempt happens only after success (confirm by code path, not “best effort”).
- Basic empty-state panels + headers (skeleton only).
- CI passes.

## Suggested structure
- components: KeyGateModal, AppShell, Panel, TelemetryHeader
- hook: useStaffGate() returns { status, verifyKey(), key, error }
- do NOT implement socket hook (Dev C will create shared hooks later; for M0 you can keep connect blocked entirely).

## PR checklist
- [ ] No socket connection before key verified (strict)
- [ ] Clear UI states (idle, verifying, error, success)
- [ ] Tests/lint/build pass
- [ ] PR title contains "M0"
