# CODEX MASTERPROMPT - M2 (Dev C)

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

## UI/UX integration (M2 - required)
- Resolve edge-state presentation issues.
- Improve reconnect messaging and confidence signals.
- Keep consistent typography/spacing/layout behavior.

## UI System Completion Checklist (Masterplan p13/p14 - M2 scope)
- Shared UI components must only be introduced when needed
  for reconnect/error/fullscreen UX.
- Do not refactor the entire UI component system in M2.
- Tighten shared-component work to M2-required pieces only:
  no full design-system rewrite
  no broad component-library migration
- [ ] Complete M2-required shared component map items from p14 only where needed:
  - `KpiPill`
  - `Button` variants (`Primary`, `Danger`, `Warning`, `Ghost`, `HugeTouch`)
  - `Toast` or `InlineAlert`
  - `LoadingSkeleton`
  - `EmptyState`
  - `Divider` and `Table`
- [ ] `ConnectionStatus` and reconnect UX are unified across public routes.
- [ ] Finished/checkered visual is implemented consistently.
- [ ] Fullscreen robustness is validated on desktop + tablet modes.
- [ ] No duplicated local components when shared version already exists.

## Hard requirements
- No polling introduced.
- Public routes remain stable under reconnect.
- Lead review ensures cross-route consistency before merge.

## Integration rule
Dev branches must remain compatible with each other.
If a change affects another developer's area,
coordinate through the canonical contract
rather than introducing alternate logic paths.

## Deliverable / DoD (M2 for Dev C)
- Reconnect and error UX is improved and consistent.
- Fullscreen behavior is robust on target display modes.
- Public route visual language remains unified.
- CI passes.

## PR checklist
- [ ] Public reconnect UX validated
- [ ] Fullscreen robustness validated
- [ ] Shared component consistency maintained
- [ ] M2 p13/p14 checklist items above are complete
- [ ] PR title contains "M2"
