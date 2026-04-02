# Lap Line Tracker Lap Entry Cleanup

## Text Removed

- Removed the redundant lap-entry section label `Authoritative entry`.
- Removed the explanatory lap-entry helper copy that repeated the current input state instead of helping the operator act faster.

## Lap-Entry Card Styling Changes

- Kept lap entry as large touch-first cards.
- Replaced the red/error-style button treatment with a neutral dark card surface.
- Changed the card emphasis to use readable light text, a subtle neutral border, and a small accent car chip instead of a failure-style fill.
- Kept hover/press affordance visible without making the default state look blocked or negative.

## 8-Racer Layout

- Changed the desktop lap-entry grid to a clean 4-column layout so 8 racers render as a `4x2` grid when the full set is present.
- Added smaller-screen fallback rules so the grid can collapse cleanly when space is tighter.

## Scope Confirmation

- Simulation logic was not changed.
- Estimated track logic and behavior were not changed.
- Backend lap recording logic was not changed.
- Race state logic was not changed.

## Validation Results

- `npm run lint` passed.
- `npm test` passed.
- `npm run build` passed.
- Live DOM validation on `/lap-line-tracker` confirmed:
  - the redundant `Authoritative entry` label is gone
  - the lap-entry helper copy is gone
  - the lap-entry grid renders `8` racer cards in `2` rows with `4` columns on desktop
  - lap-entry cards use a neutral dark background with a subtle white border instead of red/error styling
- Estimated-track and simulation controls remained present in the sidecar:
  - visual head still renders `ESTIMATED TRACK`
  - `Simulate Race` control remained present
