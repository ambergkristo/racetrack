# CODEX MASTERPROMPT - M3 (Dev C, Updated)

DEC: Dev C (Lead)
MILESTONE: M3 (UX parity + release gate)

## Precondition
M2.5 PASS is required before M3 validation begins.

## Mission
Ensure M3 does not break system truth.

## Role
Final truth gate.

## Global Guardrails
- Lifecycle correctness must not break.
- Feature flags must not hide bugs.
- Formatting and output must stay clean and readable.
- M2.5 behavior is the baseline truth when M3 flags are OFF.

## Reject If
- Lifecycle is inconsistent.
- CHECKERED is not visible.
- LOCKED is not enforced.
- UI lies versus backend truth.

## Validate
- All routes show the same state.
- Flags behave consistently.
- Lap gating is correct.

## Strict Rule
No visual-only fixes.

## Test All
- front-desk
- race-control
- lap-tracker
- leaderboard
- race-flags
- countdown

## Output
- PASS / FAIL
- issues list
- release approval YES / NO
