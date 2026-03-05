# CODEX LEAD PROMPT — Project structure & process (Dev C)

DEC: Dev C (Kristo Amberg, Lead)  
REPO: https://github.com/ambergkristo/racetrack

## Operating model (authoritative)
- 4 developers (A,B,C,D) work locally in Codex, each on their own feature branch.
- Work milestone-by-milestone: M0 -> M1 -> M2 -> M3.
- Dev C is the only one who merges to `main`.
- After all M0 PRs are merged and checks are green, we move to M1 prompts.

## Branch rules
- Base branch: main (read-only for devs)
- Each dev works in feat/m{milestone}-devX-{topic}
- PR target: main
- Dev C runs tests and verifies DoD before merge.

## Milestone gating
- No M1 work until M0 is merged.
- No M2 work until M1 is merged.
- No M3 work until M2 is merged.

## UI/UX workflow ownership (Dev C = 100%)
Dev C must integrate UI/UX tasks into every milestone at the correct moment:
- Maintain a shared design system primitives layer (AppShell/Panel/etc).
- Ensure route skeletons use shared shell.
- Maintain “dashboard/telemetry” visual style constraints (dark, high contrast, large touch targets).
- For each milestone prompt M0/M1/M2/M3, include a UI/UX section that is executed during that milestone (not later).

## Lead responsibilities
- Enforce: staff key gate before socket connect.
- Enforce: no polling; Socket.IO only.
- Enforce: CI green on main at each merge step.
- Keep PR descriptions precise; avoid scope creep.
