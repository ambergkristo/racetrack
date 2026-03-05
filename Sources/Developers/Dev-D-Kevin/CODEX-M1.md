# CODEX MASTERPROMPT — M1 (Dev D)

DEC: Dev D (Kevin)  
REPO: https://github.com/ambergkristo/racetrack  
MILESTONE: M1 (Realtime contract validation + integration coverage)  
BASE BRANCH: main (read-only)  
WORKING BRANCH: feat/m1-devD-contract-validation-tests

## Mission (M1 / Dev D scope)
Expand M0 socket baseline into stable M1 realtime quality:
- enforce event payload validation in active MVP flows
- establish integration tests for race event lifecycle paths
- protect contract stability while feature surface grows

## Non-goals (M1)
- No ownership of product UI implementation
- No ownership of backend domain logic decisions
- No overengineering beyond MVP contract needs

## Branch workflow
1) git checkout main && git pull
2) git checkout -b feat/m1-devD-contract-validation-tests
3) implement
4) run checks locally
5) commit: "M1: realtime contract validation and integration tests (Dev D)"
6) push + PR -> main (review by Dev C)

## Hard requirements
- No polling paths for live updates.
- Inbound event payloads are validated at runtime.
- Contract remains backward compatible within milestone.
- CI quality checks remain green.

## Deliverable / DoD (M1 for Dev D)
- Active M1 events are schema-validated.
- Integration tests cover baseline race flow event chain.
- Contract docs updated when event surface changes.
- CI passes.

## Suggested structure
- `docs/contracts/*` milestone updates
- socket validation module(s)
- integration tests for connection + event sequence

## PR checklist
- [ ] Validation covers active M1 events
- [ ] Integration tests added/updated
- [ ] Contract changes documented
- [ ] PR title contains "M1"
