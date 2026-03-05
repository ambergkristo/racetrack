# CODEX MASTERPROMPT — M0 (Dev A)

DEC: Dev A (Ergo)  
REPO: https://github.com/ambergkristo/racetrack  
MILESTONE: M0 (Foundation + API skeleton)  
BASE BRANCH: main (read-only)  
WORKING BRANCH: feat/m0-devA-env-bootstrap

## Mission (M0 / Dev A scope)
Implement M0 backend foundation per masterplan + milestone plan:
- env/config handling + server bootstrap
- server MUST fail fast if required keys are missing
- wrong key auth response must be delayed ~500ms (backend support as needed)
- provide socket handshake baseline (Socket.IO server up; contract details owned by Dev D)

## Non-goals (M0)
- No full race domain/state machine yet (that’s M1/M2)
- No UI changes except what is necessary to support gating contract (Dev B handles staff gate UI)

## Branch workflow
1) git checkout main && git pull
2) git checkout -b feat/m0-devA-env-bootstrap
3) implement
4) run tests/lint/build locally
5) commit with message: "M0: env/config bootstrap (Dev A)"
6) push branch and open PR -> main (assign/review by Dev C)

## Hard requirements
- Staff routes must be key-gated BEFORE Socket.IO connect (UI enforces; backend must support verify endpoint or gate mechanism).
- Server does not start if secrets/keys missing.
- Wrong key responses delay by ~500ms (avoid brute-force signal).
- Polling is not allowed; realtime via Socket.IO only.

## Deliverable / DoD (M0 for Dev A)
- App starts only when required env vars present.
- Document required env vars (README or /Sources note).
- If there is a key verification endpoint, it implements the 500ms delay on failure.
- Socket server boots without errors (even if no events yet).
- CI passes on PR.

## Implementation guidance (recommended)
- Centralize env parsing in one module (e.g. src/config/env.ts).
- Validate required vars at process start; throw with clear error.
- If you implement `/api/auth/verify` (or similar), return:
  - 200 on success
  - 401 on fail with 500ms delay
- Keep surface small; Dev D will define socket schema.

## PR checklist (must be true)
- [ ] Branch name matches spec
- [ ] No unrelated refactors
- [ ] Tests passing
- [ ] Clear PR description: what keys, how bootstrap works
- [ ] Tag PR title with "M0"
