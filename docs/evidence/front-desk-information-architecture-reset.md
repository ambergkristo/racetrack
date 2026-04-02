# Front Desk Information Architecture Reset

## What Was Removed From The Left Side

- Removed the standalone left-side `Control State` section.
- Removed the explanatory copy: `Read-only race state for the front-desk operator while the setup flow stays active.`
- Removed extra left-side helper text that was not required to create a session or choose a saved session.

## Why It Was Considered Non-Operational

The removed content did not directly help the front-desk operator perform the primary tasks on this screen:

1. create the next race/session
2. choose a saved session
3. move into racer registration on the right

It was state/meta visibility rather than an action-first setup control, so it was taking visual priority away from the actual setup flow.

## What Was Kept As Essential Operator Flow

- `Next Race Setup`
- `Create Session`
- `Session Name` input
- `Create Session` action
- one concise `Session Summary`
- `Saved Sessions`
- the lower guard/action area for blocked-state messaging

## Compact State Badge

No compact state badge was retained on the left panel. The information-architecture reset removes state visibility as a dominant part of the left setup flow.

## Validation Results

- `npm run lint` passed.
- `npm test` passed.
- `npm run build` passed.
- Live DOM inspection on `/front-desk` confirmed the standalone `Control State` section is absent, the explanatory copy is gone, the fullscreen split is still intact, and the right panel still exposes `Racer Management`, `racer-name-input`, and `save-racer-btn`.
- Left-panel section spacing measured cleanly in-browser with no internal overlap:
  - `Create Session -> Session Summary`: `12px`
  - `Session Summary -> Saved Sessions`: `12px`
  - `Saved Sessions -> guard/action area`: `18px`
- Automated UI/integration coverage still validates the next-race creation and racer-management workflow after the information reset.
