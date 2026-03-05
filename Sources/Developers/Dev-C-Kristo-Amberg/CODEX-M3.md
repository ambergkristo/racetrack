# CODEX MASTERPROMPT ā€” M3 (Dev C)

DEC: Dev C (Kristo Amberg, Lead)  
REPO: https://github.com/ambergkristo/racetrack  
MILESTONE: M3 (Upgrade UX parity + lead release gate)  
BASE BRANCH: main (read-only)  
WORKING BRANCH: feat/m3-devC-ux-parity-release-gate

## Mission (M3 / Dev C scope)
Ensure upgrade UX is integrated without breaking MVP defaults:
- maintain OFF/ON feature-flag UX parity
- keep design system coherence through upgrade additions
- enforce final release gate quality

## Non-goals (M3)
- No backend persistence ownership work (Dev A)
- No socket contract ownership work (Dev D)
- No staff route ownership takeover (Dev B)

## Branch workflow
1) git checkout main && git pull
2) git checkout -b feat/m3-devC-ux-parity-release-gate
3) implement
4) run tests/lint/build locally
5) commit: "M3: UX parity and release quality gate (Dev C)"
6) push + open PR -> main

## UI/UX integration (M3 ā€” required)
- Confirm feature-flag OFF path is unchanged from MVP.
- Confirm feature-flag ON path is coherent and predictable.
- Validate cross-route consistency after upgrade additions.

## UI System Completion Checklist (Masterplan p13/p14 - M3 scope)
- [ ] Feature-flag OFF path is visually and behaviorally identical to MVP baseline.
- [ ] Feature-flag ON path does not break shared design system primitives.
- [ ] Final audit confirms p13 token usage across all public routes.
- [ ] Final audit confirms p14 component map is either implemented or explicitly deferred with lead note.
- [ ] Public route consistency remains intact when upgrade features are enabled.
## Hard requirements
- No default behavior drift when flags are OFF.
- No polling introduced.
- Lead merge gate blocks incomplete upgrade quality.

## Deliverable / DoD (M3 for Dev C)
- OFF/ON UX parity documented and validated.
- Public route consistency maintained after upgrade changes.
- Release readiness sign-off provided.
- CI passes.

## PR checklist
- [ ] OFF path parity validated
- [ ] ON path UX validated
- [ ] Release gate criteria met
- [ ] M3 p13/p14 checklist items above are complete
- [ ] PR title contains "M3"

