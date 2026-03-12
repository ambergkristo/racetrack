# CODEX MASTERPROMPT — M2 (Dev B)

DEC: Dev B (Kristo Leier)  
REPO: https://github.com/ambergkristo/racetrack  
MILESTONE: M2 (Staff UX hardening)  
BASE BRANCH: main (read-only)  
WORKING BRANCH: feat/m2-devB-staff-ux-hardening

## Mission (M2 / Dev B scope)
Harden staff UX for resilience:
- reconnect/resync behavior in staff routes
- disabled-state reasons and blocked-action clarity
- reduce operator confusion under edge conditions

## Non-goals (M2)
- No M3 feature-flag product expansion
- No major visual redesign outside consistency goals
- No backend contract ownership changes

## Branch workflow
1) git checkout main && git pull
2) git checkout -b feat/m2-devB-staff-ux-hardening
3) implement
4) run tests/lint/build locally
5) commit: "M2: staff UX hardening and resilience (Dev B)"
6) push + open PR -> main (review by Dev C)

## Hard requirements
- Existing M1 flows must stay intact.
- Error states must be actionable and explicit.
- No polling for live data.
- Staff gate cannot be bypassed during reconnect.

Reconnect UX must rely on canonical socket snapshot events.
Dev B must not implement local reconnect recovery logic that diverges from backend state.

## Deliverable / DoD (M2 for Dev B)
- Reconnect behavior is predictable on staff routes.
- Disabled actions include user-facing reason.
- Error handling is clear and recoverable.
- CI passes.

## Suggested structure
- reconnect banner/status components
- standardized action-guard UI helpers
- shared error presentation pattern

## Integration rule
Dev branches must remain compatible with each other.
If a change affects another developer's area,
coordinate through the canonical contract
rather than introducing alternate logic paths.

## PR checklist
- [ ] Reconnect and blocked-state UX covered
- [ ] No gate bypass path
- [ ] No unrelated refactors
- [ ] PR title contains "M2"
