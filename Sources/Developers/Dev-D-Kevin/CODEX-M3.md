# CODEX MASTERPROMPT - M3 (Dev D, Updated)

DEC: Dev D (Kevin)
MILESTONE: M3 (Quality gate)

## Precondition
M2.5 PASS is required before M3 validation begins.

## Mission
Validate all flag combinations.

## Global Guardrails
- Lifecycle correctness must not break.
- Feature flags must not hide bugs.
- Formatting and output must stay clean and readable.
- M2.5 behavior is the baseline truth when M3 flags are OFF.

## Matrix
- `FF_PERSISTENCE` ON / OFF
- `FF_MANUAL_CAR_ASSIGNMENT` ON / OFF

## Validate For Each Combination
- lifecycle correctness
- lap gating
- CHECKERED behavior
- LOCKED enforcement
- restart recovery

## Failure Rule
Any failure means M3 FAIL.

## CI
- Must run the full matrix.
- Must block on failure.

## Output
- PASS / FAIL
- matrix results
- failures
