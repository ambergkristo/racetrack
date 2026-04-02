# Control Hub Scroll Fix

## Root Cause Of The Scroll

Control Hub was spending too much desktop height above the operational panels. The main contributors were the full telemetry header footprint, the standalone top-right socket status card, and a redundant descriptive launch-board intro block before the route cards.

## What Was Reduced Or Removed

- Compacted the Control Hub header so the page title and route tags remain, but the home route no longer renders the expanded subtitle/caption block.
- Removed the standalone top-right socket status card from Control Hub and folded connection state into a compact inline header tag.
- Removed the extra launch-board helper copy block so the route sections begin immediately inside the Route Launch Board panel.
- Tightened Control Hub panel padding, route-card spacing, KPI height, and section spacing so Race Overview and Route Launch Board start higher on the page.

## What Was Kept Intentionally

- The Beachside Racetrack title and telemetry-style route tags remain for page identity.
- Race Overview still shows the essential operator summary: flag, active session, queued sessions, and route count.
- Route Launch Board still exposes the same staff and public routes without changing behavior or route structure.
- Dark telemetry styling and existing launch-card affordances were preserved.

## Validation Result

- Command validation passed:
  - `npm run lint`
  - `npm test`
  - `npm run build`
- Live Control Hub check passed at `1440x900`:
  - `scrollHeight === innerHeight` (`900`), so the page did not require vertical scroll
  - Race Overview and Route Launch Board both started at roughly `72.9px` from the top of the viewport
  - Standalone socket status card was absent on Control Hub
  - Inline socket status remained visible as a compact header tag
  - All 7 route cards remained visible within the viewport without clipping
