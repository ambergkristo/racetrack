# CODEX MASTERPROMPT — M2 (Dev A)

DEC: Dev A (Ergo)  
REPO: https://github.com/ambergkristo/racetrack  
MILESTONE: M2 (Hardening backend consistency)  
BASE BRANCH: main (read-only)  
WORKING BRANCH: feat/m2-devA-backend-hardening

## Mission (M2 / Dev A scope)
Harden backend behavior for reliability:
- idempotency and duplicate-event safety
- edge-case handling in lifecycle operations
- consistency under reconnect/resync scenarios
- robust error boundaries for invalid state operations

## Non-goals (M2)
- No persistence feature work (M3)
- No major UI redesign
- No new product scope outside hardening

## Branch workflow
1) git checkout main && git pull
2) git checkout -b feat/m2-devA-backend-hardening
3) implement
4) run tests/lint/build locally
5) commit: "M2: backend hardening and consistency (Dev A)"
6) push + open PR -> main (review by Dev C)

## Hard requirements
- Preserve existing M1 behavior (no regressions).
- No polling introduction.
- Illegal transitions must fail predictably with clear error responses.
- Coordinate with Dev D test suite expectations.

## Deliverable / DoD (M2 for Dev A)
- Duplicate/retry-safe handling for key mutation flows.
- Edge-case lifecycle operations are deterministic.
- Reconnect/resync does not corrupt canonical state.
- CI passes with integration coverage.

## Suggested structure
- domain guard/refinement modules
- explicit error codes for blocked actions
- idempotency helpers where needed

## PR checklist
- [ ] Regression risk documented
- [ ] Edge cases covered by tests
- [ ] No product-scope creep
- [ ] PR title contains "M2"
