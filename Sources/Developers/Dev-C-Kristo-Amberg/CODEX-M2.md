# CODEX MASTERPROMPT — M2 (Dev C)

DEC: Dev C (Kristo Amberg, Lead)  
REPO: https://github.com/ambergkristo/racetrack  
MILESTONE: M2 (Public UX hardening + consistency gate)  
BASE BRANCH: main (read-only)  
WORKING BRANCH: feat/m2-devC-public-ux-hardening

## Mission (M2 / Dev C scope)
Harden public UI/UX and enforce visual/system consistency:
- reconnect/resync communication clarity
- fullscreen robustness improvements
- micro-interactions and state clarity for spectators/racers

## Non-goals (M2)
- No M3 feature expansion by default
- No backend contract ownership work
- No bypass of lead quality gates

## Branch workflow
1) git checkout main && git pull
2) git checkout -b feat/m2-devC-public-ux-hardening
3) implement
4) run tests/lint/build locally
5) commit: "M2: public UX hardening and consistency enforcement (Dev C)"
6) push + open PR -> main

## UI/UX integration (M2 — required)
- Resolve edge-state presentation issues.
- Improve reconnect messaging and confidence signals.
- Keep consistent typography/spacing/layout behavior.

## Hard requirements
- No polling introduced.
- Public routes remain stable under reconnect.
- Lead review ensures cross-route consistency before merge.

## Deliverable / DoD (M2 for Dev C)
- Reconnect and error UX is improved and consistent.
- Fullscreen behavior is robust on target display modes.
- Public route visual language remains unified.
- CI passes.

## PR checklist
- [ ] Public reconnect UX validated
- [ ] Fullscreen robustness validated
- [ ] Shared component consistency maintained
- [ ] PR title contains "M2"
