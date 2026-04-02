# Staff Auth Input Focus Fix

## Root cause

The shared staff-auth modal stores the access key in UI state on every `input` event. That state update calls the global `render()` function, which rebuilds the whole app shell with `appEl.innerHTML = ...`.

Because the `#staff-key` field was recreated on every keystroke, the browser lost the original focused input node and the cursor disappeared after each character.

## What changed

- added a render-time capture of the current staff-key focus and caret position
- after the rerender completes, the shared auth flow now restores focus to the new `#staff-key` input and reapplies the caret position when the modal is still active
- kept the existing auth logic, delayed invalid-key handling, and modal layout unchanged

## Shared auth component impact

Yes. The fix is in the shared staff-auth render path, so it applies to:

- `/front-desk`
- `/race-control`
- `/lap-line-tracker`

## Validation results

- targeted UI regression passed for `/front-desk`, `/race-control`, and `/lap-line-tracker`
- `npm run lint` passed
- `npm test` passed
- `npm run build` passed
