# CODEX MASTERPROMPT — M2 (Dev D)

DEC: Dev D (Kevin)  
REPO: https://github.com/ambergkristo/racetrack  
MILESTONE: M2 (Resilience tests + observability baseline)  
BASE BRANCH: main (read-only)  
WORKING BRANCH: feat/m2-devD-resilience-observability

## Mission (M2 / Dev D scope)
Harden reliability through tests and diagnostics:
- reconnect/resync test coverage
- edge-case and idempotency-oriented socket tests
- observability baseline (structured logs + key error surfaces)

## Non-goals (M2)
- No ownership of UI polish implementation
- No broad backend refactor ownership
- No new product-scope expansion

## Branch workflow
1) git checkout main && git pull
2) git checkout -b feat/m2-devD-resilience-observability
3) implement
4) run checks locally
5) commit: "M2: resilience testing and observability baseline (Dev D)"
6) push + PR -> main (review by Dev C)

## Hard requirements
- Contract checks must catch invalid payloads reliably.
- Reconnect behavior must be test-covered.
- Error logging paths must be explicit and actionable.
- CI remains blocking for failures.

## Deliverable / DoD (M2 for Dev D)
- Reconnect/edge tests added and passing.
- Idempotency-sensitive flows have regression coverage.
- Baseline observability events documented and emitted.
- CI passes.

## Suggested structure
- integration/resilience test suites
- structured logging helpers
- docs updates for diagnostics

## PR checklist
- [ ] Reconnect and edge-case tests included
- [ ] Observability baseline documented
- [ ] CI gate remains strict
- [ ] PR title contains "M2"
