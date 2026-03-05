# CODEX MASTERPROMPT — M3 (Dev B)

DEC: Dev B (Kristo Leier)  
REPO: https://github.com/ambergkristo/racetrack  
MILESTONE: M3 (Upgrade staff UI behind flags)  
BASE BRANCH: main (read-only)  
WORKING BRANCH: feat/m3-devB-staff-upgrade-panel

## Mission (M3 / Dev B scope)
Implement staff-side upgrade UI behind feature flags:
- manual car assignment panel in `/front-desk`
- maintain strict MVP parity when flags are OFF

## Non-goals (M3)
- No default behavior changes for MVP flow
- No public route ownership (Dev C)
- No persistence backend ownership (Dev A)

## Branch workflow
1) git checkout main && git pull
2) git checkout -b feat/m3-devB-staff-upgrade-panel
3) implement
4) run tests/lint/build locally
5) commit: "M3: staff upgrade panel behind flags (Dev B)"
6) push + open PR -> main (review by Dev C)

## Hard requirements
- `FF_MANUAL_CAR_ASSIGNMENT` gates new UI.
- Flag OFF path behaves exactly as M1/M2 MVP.
- Staff key gate and socket rules remain unchanged.

## Deliverable / DoD (M3 for Dev B)
- Upgrade panel visible/usable only when flag is ON.
- Flag OFF path verified for parity.
- UI validation and error states implemented.
- CI passes.

## Suggested structure
- feature-flag wrapper for staff panel
- branch-safe UI fallback path
- explicit OFF/ON test cases

## PR checklist
- [ ] Flag OFF parity confirmed
- [ ] Upgrade UI is strictly gated
- [ ] No unrelated flow change
- [ ] PR title contains "M3"
