# CODEX MASTERPROMPT — M3 (Dev D)

DEC: Dev D (Kevin)  
REPO: https://github.com/ambergkristo/racetrack  
MILESTONE: M3 (Feature-flag matrix + persistence quality gate)  
BASE BRANCH: main (read-only)  
WORKING BRANCH: feat/m3-devD-flag-matrix-persistence-tests

## Mission (M3 / Dev D scope)
Provide final quality gate for upgrade rollout:
- feature-flag OFF/ON matrix validation
- persistence/restart behavior integration coverage
- maintain contract/test/CI integrity across upgrade modes

## Non-goals (M3)
- No ownership of persistence implementation internals (Dev A)
- No ownership of manual assignment UI implementation (Dev B)
- No ownership of visual UX implementation (Dev C)

## Branch workflow
1) git checkout main && git pull
2) git checkout -b feat/m3-devD-flag-matrix-persistence-tests
3) implement
4) run checks locally
5) commit: "M3: feature-flag matrix and persistence quality gate (Dev D)"
6) push + PR -> main (review by Dev C)

## Hard requirements
- OFF path must remain equivalent to MVP baseline.
- ON path must be fully test-covered for upgrade behavior.
- Contract compatibility must be maintained.
- CI must block failing matrix combinations.

## Deliverable / DoD (M3 for Dev D)
- Automated OFF/ON matrix tests present and green.
- Persistence restart/recovery integration tests pass.
- Contract docs reflect final M3 state.
- CI passes with quality gate intact.

## Suggested structure
- matrix test suite for flags
- persistence integration tests
- CI workflow updates (if needed) for matrix execution

## PR checklist
- [ ] OFF/ON matrix coverage complete
- [ ] Persistence tests included
- [ ] Contract compatibility confirmed
- [ ] PR title contains "M3"
