# CODEX MASTERPROMPT — M0 (Dev C)

DEC: Dev C (Kristo Amberg, Lead)  
REPO: https://github.com/ambergkristo/racetrack  
MILESTONE: M0 (Foundation + route skeletons + fullscreen base)  
BASE BRANCH: main (read-only)  
WORKING BRANCH: feat/m0-devC-public-skeleton-ux

## Mission (M0 / Dev C scope)
Deliver M0 public UI route skeletons + fullscreen base, and establish shared UI primitives that everyone can reuse.

Public routes:
- /leader-board
- /next-race
- /race-countdown
- /race-flags

M0 demo requirement: all routes open and render; staff gating handled by Dev B.

## Branch workflow
1) git checkout main && git pull
2) git checkout -b feat/m0-devC-public-skeleton-ux
3) implement
4) run tests/lint/build
5) commit: "M0: public routes skeleton + shared UI primitives (Dev C)"
6) push + PR -> main

## UI/UX integration (M0 — must be done now)
Create design system primitives (shared):
- AppShell
- Panel
- TelemetryHeader
- FullscreenButton
- KeyGateModal (can be shared even if Dev B wires it)

Apply AppShell across ALL route skeletons (public routes at minimum; keep it reusable for staff routes).

Fullscreen base:
- Provide a consistent fullscreen experience for public screens (button + CSS baseline).
- Ensure large touch targets and legible typography.

## Hard requirements
- No polling; do not build fetch loops for live state.
- Staff routes must connect socket only after gating (Dev B handles; Dev C should not break that architecture).
- Keep M0 minimal but visually consistent (dashboard look).

## Deliverable / DoD (M0 for Dev C)
- Public routes render without crashes.
- Shared UI primitives exist and are used by public routes.
- Fullscreen baseline exists (toggle button, layout supports kiosk use).
- CI passes.

## PR checklist
- [ ] Shared primitives exported cleanly (no circular deps)
- [ ] Public routes use AppShell + Panel
- [ ] No polling logic introduced
- [ ] PR title contains "M0"
