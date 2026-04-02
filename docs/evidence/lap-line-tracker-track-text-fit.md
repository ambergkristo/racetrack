# Lap Line Tracker Track Text Fit

## Removed Or Reduced Text And Chrome

- Removed the larger track-panel title block and its helper sentence from the Lap Line Tracker track panel.
- Removed the track-panel status badge such as `Simulation Idle` from inside the track panel because the same state is already visible in the main lap-entry header tags.
- Kept only a single compact track label row so the panel still reads intentionally while using less vertical space.
- Tightened track-panel padding and reduced the gap above the SVG so the map receives more visible height in fullscreen.

## Repositioned Items

- The track panel now uses a minimal one-line header instead of a multi-line title/copy block above the map.
- The fullscreen variant uses slightly tighter inner padding so the map gets more room without changing track geometry.

## Finish And Pit Labels

- The large `Finish` text label was reduced to a small `F` marker next to the finish line.
- The large `Pit Lane` label was reduced to a smaller `PIT` marker.
- Finish and pit meaning remain visible, but the labels now consume less space and feel less intrusive.

## Simulation Logic

- Simulation logic was unchanged.
- Track geometry was unchanged.
- Race-state logic was unchanged.
- This change only reduces text and chrome around the track panel to improve fullscreen fit.

## Validation Results

- `npm run lint` passed.
- `npm test` passed.
- `npm run build` passed.
