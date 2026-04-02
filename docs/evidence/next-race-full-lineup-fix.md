# Next Race Full Lineup Fix

## Root Cause

- The Next Race page was not losing racers in backend truth.
- The truncation came from the frontend render path in `client/app.js`.
- Both `On track now` and `Up next` passed `limit: 4` into `rosterStrip(...)`.
- `rosterStrip(...)` then used `.slice(0, limit)`, which silently cut both 8-racer lists down to 4 visible cards.

## Rendering And Layout Change

- Removed the `limit: 4` override from both Next Race roster blocks so they now use the full route lineup.
- Kept the shared roster renderer, but added a Next Race specific grid class so the route can control the public card layout safely.
- Updated Next Race public CSS to render lineup cards in a readable `4 x 2` grid for 8-racer sessions.
- Tightened card spacing and copy sizing slightly on this route so all 8 racer cards fit cleanly without overflow.

## Full 8 Racer Confirmation

- `On track now` now renders the full current-session roster, up to 8 racers.
- `Up next` now renders the full queued-session roster, up to 8 racers.
- Assigned car numbers remain visible on every roster card.
- The visible roster card count now matches the displayed current/next racer counters.

## Validation Results

- `npm run lint` passed.
- `npm test` passed.
- `npm run build` passed.
