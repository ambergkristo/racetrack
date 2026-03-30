# Phase 4 Layout Recovery

## Historical commits used as reference
- `3914e240335a21844de9d0453f290666c94bbcf7`
  - last known good Phase 4 state merged to `main`
  - used as the historical source of truth for shared staff-shell/layout behavior
- `956503555444d41e6cdfda8be83578d2a0776550`
  - later front-desk fullscreen/layout hotfix that introduced route-specific full-height shell constraints
- `cf2b9a271028e3883f64013a26b8fb8013a3ac68`
  - later lap-line-tracker estimated-track commit that introduced fixed sidecar height pressure

## Which files contained the good settings
- `client/app.css`
  - Phase 4 baseline used the shared `.staff-shell`, `.staff-route-grid`, `.frontdesk-workflow`, and `.lap-tracker-shell` layout without the later route-specific fullscreen height clamps.
- `client/app.js`
  - inspected to confirm that the current regressions were layout-driven rather than caused by route logic changes.

## What regressed later
- Front Desk:
  - later commits introduced route-specific `height: 100%`, `overflow: hidden`, and internal scroll-body behavior around:
    - `.route-front-desk .frontdesk-panel`
    - `.route-front-desk .frontdesk-shell-grid`
    - `.route-front-desk .frontdesk-setup-body`
  - this diverged from the simpler Phase 4 vertical allocation and made fullscreen clipping more likely.
- Lap Line Tracker:
  - later estimated-track work introduced route-specific fixed vertical pressure via:
    - `--lap-track-panel-height`
    - `.route-lap-line-tracker .lap-tracker-sidecar { min-height: var(--lap-track-panel-height); }`
  - this was not part of the Phase 4 baseline and made bottom clipping more likely.

## What was restored
- Front Desk:
  - restored Phase 4 style fullscreen behavior by removing the hard fullscreen clamp for the route shell and front-desk workbench in fullscreen.
  - allowed the setup body to flow visibly in fullscreen instead of remaining trapped in a clipped internal scroll area.
- Lap Line Tracker:
  - restored Phase 4 style vertical flexibility by removing the fixed sidecar minimum height and allowing the shell to size naturally in fullscreen.
  - changed the shell alignment so the route no longer stretches vertically more than needed.

## Why this matches Phase 4 truth
- The Phase 4 merged `main` baseline did not use these later route-specific height clamps or fixed estimated-track panel heights.
- The problematic constraints were added later by targeted hotfix/feature commits, so removing those clamps is a recovery to the earlier known-good layout philosophy rather than a redesign.
- The recovery keeps current functionality intact while restoring the earlier main-branch layout behavior that was less prone to clipping.
