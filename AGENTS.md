# Racetrack Repository Law

## Canonical Repository Rule
- The canonical repository for this project is `https://github.com/ambergkristo/racetrack`.
- Every Codex session must treat that repository as authoritative.
- If `git remote -v` shows that `origin` is not `https://github.com/ambergkristo/racetrack`, Codex must stop immediately and report:
  - `Wrong repository: switch to https://github.com/ambergkristo/racetrack before continuing.`
- Codex must never continue implementation, audit, merge, integration, or release-gate work in any repository whose `origin` is not the canonical Racetrack repository.

## Mandatory Preflight
Before any substantive work, Codex must verify and report:
- current working directory
- `git remote -v`
- current branch
- `git rev-parse HEAD`
- whether the workspace is clean, dirty, detached, or otherwise unsafe
- whether the current target is `main`, a developer branch, or an integration branch

Required preflight checklist:
- verify origin remote
- verify branch
- verify clean or safe workspace
- verify whether working on `main`, a dev branch, or an integration branch
- state this in output before proceeding

If the canonical remote check fails, Codex must stop immediately.

## Workspace Rule
- If the local worktree is dirty, detached, or otherwise unsafe, Codex may use a clean temporary worktree or clone.
- Any temporary worktree or clone must still point to `https://github.com/ambergkristo/racetrack`.
- Codex must explicitly report when it is using a temporary worktree.
- Codex must never continue in a temporary workspace whose `origin` is not the canonical repository.

## Phase Integration Rule
- For post-M3 phases, developer branches do not merge directly to `main`.
- The required workflow is:
  - dev branch -> phase integration branch -> gate/PASS -> `main`
- If required phase integration is missing, Codex must stop and say:
  - `Phase integration is required before merge to main.`

## Main Is Truth Rule
- `main` is the source of truth between phases.
- M2.5 and M3 are already locked on `main`.
- Do not reopen M3 unless explicitly instructed.

## No Scope Drift
- Do not redesign the system from scratch.
- Do not change lifecycle truth.
- Do not break OFF/ON feature-flag behavior.
- Prefer minimal, high-value changes.
- End each phase with evidence and PASS/FAIL.

## Existing Project Operating Model
- The project uses four developers: Dev A, Dev B, Dev C, and Dev D.
- Work progresses milestone-by-milestone and phase-by-phase.
- Dev C is the merge authority to `main`, unless explicit repository law later overrides that responsibility.
- Base branch is `main`.
- Developer work happens in feature branches.
- Codex must avoid scope creep and keep changes precise.

## Historical Milestone Guardrail
- M0 -> M1 -> M2 -> M3 was milestone-gated work.
- No future Codex session may treat M3 as open by default.
- Post-M3 work must respect the locked `main` baseline and the phase integration rule above.
