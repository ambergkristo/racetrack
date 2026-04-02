# Sprint 1 Simulation Track Foundation

## Track Path Model

- Replaced the oval estimate view with a reusable top-down telemetry loop defined from explicit track points in `client/app.js`.
- Built the main loop as a closed polyline path and the pit lane as a separate connected open path so Sprint 2 can attach pit-return behavior without redesigning the panel.
- Derived the finish line from the track geometry itself by sampling the path at progress `0` and projecting a perpendicular marker across the lane.
- Kept all rendering inside the existing estimated-track panel and SVG viewbox to avoid route-level layout changes.

## Marker Rendering

- Replaced the larger name-heavy markers with compact telemetry pins: a small halo, a tighter numbered dot, and an optional finish-place badge.
- Added per-car hue variation so up to 8 cars stay distinguishable without turning the markers into cartoon car icons.
- Kept leader and finished states visually distinct with green and yellow emphasis layers.

## 5-Lap Timing Foundation

- The authoritative simulation default now targets `5` laps instead of `3`.
- Default lap targets now sit in an approximately `20–25s` window using seeded per-racer baseline pace plus bounded jitter.
- Progress remains server-authoritative: the backend advances each racer by elapsed time against the current lap target, while the client only smooths the received progress for rendering.
- Added regression coverage to confirm the default simulation starts with `8` racers, `5` laps, and target lap durations inside the intended window.

## Deferred To Sprint 2

- Hazard or flag-specific scenario choreography.
- Pit-return behavior and pit-lane occupancy logic.
- Checkered sequencing beyond the existing canonical finish flow.
- Session-end choreography and broader simulation storytelling.
- Any redesign of the rest of the lap-line-tracker page outside the track panel.

## Validation Results

- `npm run lint` passed.
- `npm test` passed.
- `npm run build` passed.
- UI regression coverage now checks that the lap-line-tracker render still includes `Finish` and `Pit Lane`.
- Simulation defaults are covered by test for `8` cars, `5` laps, and `20–25s` initial lap targets.
