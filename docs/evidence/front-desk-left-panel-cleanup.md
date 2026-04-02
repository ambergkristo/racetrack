# Front Desk Left Panel Cleanup

## What Was Removed Or Reduced From The Left Panel

- Removed the standalone `Control State` section from the left setup panel.
- Removed the dense status-marquee and KPI-style control block that was surfacing more backend/system detail than the front-desk operator needs during setup.
- Reduced explanatory copy so the setup flow stays focused on naming the next race, checking the next step, and reviewing saved sessions.
- Tightened left-panel spacing and section chrome so the setup flow reads top-to-bottom without overlap or noise.

## What Was Intentionally Kept

- `Next Race Setup`
- `Create Session`
- `Session Name` input and save/cancel actions
- a lightweight setup summary with the current track state, current race, standby-roster count, and saved-session count
- the `Saved Sessions` area for the setup flow
- guard messaging when actions are blocked

## Right Panel Confirmation

The right racer-management panel was not functionally changed. Its role, markup, workflow, and standby space for showing up to 8 racers were preserved.

## Next-Race Creation Flow Confirmation

The workflow remains the same:

1. Create the next race/session on the left
2. Add racers afterward on the right
3. Keep the right panel available as the standby racer-management area

## Validation Results

- Command validation passed:
  - `npm run lint`
  - `npm test`
  - `npm run build`
- Live Front Desk DOM validation at `1440x900` passed:
  - left setup card and right racer card both rendered
  - no overlap between the two cards
  - left panel kept `Create Session`, `Setup Summary`, and `Saved Sessions`
  - left panel no longer rendered a standalone `Control State` section
  - right panel still rendered `Racer Management`, racer-name input, and save-racer action
- Workflow validation passed through automated tests:
  - next-race/session creation flow still renders and is covered by UI/integration tests
  - racer-add flow remains available on the right after session setup
