# Lap Line Tracker Remove Meta Row

## Removed Row

- Removed the Lap Line Tracker meta/debug chip row that showed:
- `Gate Bypassed`
- `Manual Assign: OFF`
- `Sync live`
- `Last sync ...`

## Why It Was Non-Essential

- The row was operationally redundant for lap entry.
- It exposed gate, feature-flag, and sync status details instead of controls the operator needs to record laps.
- Removing it frees vertical space for the simulation track panel without changing the track or simulation behavior.

## Simulation Logic

- Simulation logic was not changed.
- Track geometry was not changed.
- Race state and lap-entry behavior were not changed.
- The change only removes the non-essential Lap Line Tracker meta/debug row.

## Validation Results

- `npm run lint` passed.
- `npm test` passed.
- `npm run build` passed.
