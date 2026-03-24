# CODEX MASTERPROMPT - M3 (Dev A, Updated)

DEC: Dev A (Ergo)
MILESTONE: M3 (Persistence + Recovery)
WORKING BRANCH: feat/m3-devA-persistence-recovery

## Precondition
M2.5 CONTROL STABILIZATION must be PASS before M3 work begins.

## Mission
Implement persistence and recovery without breaking lifecycle truth.

## Global Guardrails
- Lifecycle correctness must not break.
- Feature flags must not hide bugs.
- Formatting and output must stay clean and readable.
- M2.5 behavior is the baseline truth when M3 flags are OFF.

## Strict Rules
- `FF_PERSISTENCE` is required.
- Flag OFF must be identical to M2.5.
- Do not change lifecycle logic.
- Do not change lap logic.

## Core Persistence Scope
Persist:
- session
- racers
- lifecycle
- laps
- flag state, including CHECKERED

## Recovery Scope
Restore exact state for:
- IDLE
- STAGING
- RUNNING
- FINISHED
- LOCKED

No auto-transitions are allowed during recovery.

## Critical Invariants
- LOCKED must remain locked.
- CHECKERED must persist.
- Laps must not reset.

## Required Test Flow
1. RUN -> add laps -> FINISH -> restart -> verify restored state.
2. LOCK -> restart -> verify locked state is preserved.

## Output
- PASS / FAIL
- files changed
- verification steps

## Git
- commit
- push `origin/main`
- verify `HEAD == origin/main`
