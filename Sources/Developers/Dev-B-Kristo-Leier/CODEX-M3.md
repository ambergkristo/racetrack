# CODEX MASTERPROMPT - M3 (Dev B, Updated)

DEC: Dev B (Kristo Leier)
MILESTONE: M3 (Staff upgrade panel)
WORKING BRANCH: feat/m3-devB-staff-upgrade-panel

## Precondition
M2.5 PASS is required before M3 work begins.

## Mission
Add manual car assignment UI behind a feature flag.

## Global Guardrails
- Lifecycle correctness must not break.
- Feature flags must not hide bugs.
- Formatting and output must stay clean and readable.
- M2.5 behavior is the baseline truth when M3 flags are OFF.

## Rules
- `FF_MANUAL_CAR_ASSIGNMENT` is required.
- Flag OFF must be identical to M2.5.
- No lifecycle changes are allowed.

## Behavior
- Assignment is allowed only in STAGING.
- Assignment becomes locked after START.

## Forbidden
- Editing during RUNNING.
- Editing after LOCKED.

## Required Test Flow
1. Create -> assign -> start -> try edit -> must fail.
2. Flag OFF -> verify identical M2.5 behavior.

## Output
- PASS / FAIL
- flag parity validation
