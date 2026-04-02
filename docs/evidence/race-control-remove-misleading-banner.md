# Race Control Remove Misleading Banner

## What Text Was Removed

- Removed the `LIVE ORDER` section label.
- Removed the message `TRACK ORDER STAYS VISIBLE WHILE CONTROLS STAY COMPACT.`

## Why It Was Misleading / Non-Operational

That block did not represent live race state, a real control, or any required operational status. It behaved like placeholder presentation copy above the race-order table and could be mistaken for meaningful control-room information.

## Functionality Confirmation

- No Race Control logic changed.
- No controls changed.
- No table behavior changed.
- Only the misleading banner/header block above the race-order table was removed.

## Validation Results

- `npm run lint` passed.
- `npm test` passed.
- `npm run build` passed.
- Live DOM inspection on `/race-control` confirmed both removed texts are absent:
  - `Live order`
  - `Track order stays visible while controls stay compact.`
- The Race Control console remained intact, and the live-order card still renders its content area without a dead gap or layout breakage.
- In the empty-state case, the live-order card now starts directly with the content block (`gapAboveFirstChild: 21px` from card padding only), rather than a separate banner/header row.
