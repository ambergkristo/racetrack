# Front Desk Remove Bottom Helper Boxes

## Which Bottom Boxes Were Removed

- Removed the left-panel `CREATE SESSION` helper box.
- Removed the left-panel `ADD RACER` helper box.

## Why They Were Considered Redundant

Those boxes repeated information that was already communicated by the actual controls:

- the `Session Name` input and `Create Session` action already define the session-creation step
- the right-side racer panel already explains when racer entry becomes available
- the blocked-state logic still disables actions correctly without needing two extra yellow summary boxes

## What Spacing Was Rebalanced

- Removed the `frontdesk-guard-strip` block from the bottom of the left setup panel.
- Removed Front Desk specific guard-strip spacing and grid rules that were reserving visual weight for those helper boxes.
- Let the `Saved Sessions` section become the natural end of the left-panel flow so the lower portion tightens without leaving a dead zone.

## Confirmation That Functionality And The Right Panel Were Unchanged

- Session creation logic was not changed.
- Racer-management logic was not changed.
- Saved-session actions were not changed.
- The right `Racer Management` panel and fullscreen two-column split were left intact.

## Validation Results

- `npm run lint` passed.
- `npm test` passed.
- `npm run build` passed.
- Live DOM inspection on `/front-desk` confirmed the left setup panel no longer renders `#front-desk-guards`, and neither helper reason remains inside the left-panel flow.
- Left-panel spacing stayed clean after the removal:
  - `Create Session -> Session Summary`: `12px`
  - `Session Summary -> Saved Sessions`: `12px`
  - Remaining space below `Saved Sessions` to the setup-card edge: `11px`
- The right panel still exposes `Racer Management`, `racer-name-input`, and `save-racer-btn`, and the two-column split remained aligned with a `10px` inter-panel gap and `0px` top offset difference.
