# Racetrack Developer Workspace

Repository:
https://github.com/ambergkristo/racetrack

Milestone workflow:
M0 → M1 → M2 → M3

Rules:
- Work ONLY in feature branches.
- Never commit directly to main.
- All PRs reviewed and merged by Dev C (lead).
- Each milestone must be completed before the next begins.

Branch naming:

feat/m{milestone}-devX-topic

Examples:

feat/m0-devA-env-bootstrap
feat/m0-devB-staff-gate
feat/m0-devC-public-ui
feat/m0-devD-socket-contract

Workflow:

1 git checkout main
2 git pull
3 git checkout -b feat/mX-devX-topic
4 implement milestone scope
5 push branch
6 open PR
7 Dev C merges after tests pass
