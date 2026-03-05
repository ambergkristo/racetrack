# CODEX MASTERPROMPT — M3 (Dev A)

DEC: Dev A (Ergo)  
REPO: https://github.com/ambergkristo/racetrack  
MILESTONE: M3 (Upgrade backend: persistence + recovery)  
BASE BRANCH: main (read-only)  
WORKING BRANCH: feat/m3-devA-persistence-recovery

## Mission (M3 / Dev A scope)
Implement upgrade backend behind feature flags:
- persistence layer integration
- recovery/restore policy after restart
- keep default MVP behavior unchanged when flags are OFF

## Non-goals (M3)
- No default behavior changes when feature flags are off
- No unrelated UI ownership work
- No breaking contract changes without Dev C + Dev D alignment

## Branch workflow
1) git checkout main && git pull
2) git checkout -b feat/m3-devA-persistence-recovery
3) implement
4) run tests/lint/build locally
5) commit: "M3: persistence and recovery backend (Dev A)"
6) push + open PR -> main (review by Dev C)

## Hard requirements
- Feature flags:
  - `FF_PERSISTENCE`
  - `FF_MANUAL_CAR_ASSIGNMENT` compatibility path
- Flag OFF path must behave exactly like MVP.
- Startup/restart restore policy must be deterministic.

## Deliverable / DoD (M3 for Dev A)
- Persistence adapter integrated behind flag.
- Recovery flow documented and tested.
- Flag OFF/ON behavior validated.
- CI passes.

## Suggested structure
- `src/persistence/*` abstraction
- restore policy module
- migration-safe storage format

## PR checklist
- [ ] Flag OFF parity confirmed
- [ ] Restore behavior tested
- [ ] No breaking API change
- [ ] PR title contains "M3"
