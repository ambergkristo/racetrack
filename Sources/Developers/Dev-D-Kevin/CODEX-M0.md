# CODEX MASTERPROMPT — M0 (Dev D)

DEC: Dev D (Kevin)  
REPO: https://github.com/ambergkristo/racetrack  
MILESTONE: M0 (Socket schema baseline + CI gates)  
BASE BRANCH: main (read-only)  
WORKING BRANCH: feat/m0-devD-socket-schema-ci

## Mission (M0 / Dev D scope)
Establish M0 foundation for:
- Socket.IO schema baseline (event names + payload shapes as a minimal contract, even if empty)
- Validation approach (zod/io-ts/etc) chosen and wired
- CI quality gates baseline (lint/test/build) so M0 demo is stable

M0 deliverable: socket handshake works, schema exists, CI passes.

## Non-goals (M0)
- No full race events/state yet (later milestones)
- No UI work except minimal compile fixes if required by shared types

## Branch workflow
1) git checkout main && git pull
2) git checkout -b feat/m0-devD-socket-schema-ci
3) implement
4) run checks locally
5) commit: "M0: socket schema baseline + CI gates (Dev D)"
6) push + PR -> main (review by Dev C)

## Hard requirements
- Polling is not allowed; realtime via Socket.IO only.
- Contract should be forward-compatible: M0 includes handshake + reserved events for snapshot, status, errors.
- Keep it minimal; do not block M0 demo with overengineering.

## Deliverable / DoD (M0 for Dev D)
- Define a typed contract module (e.g. src/socket/contract.ts).
- Add runtime validation for inbound events (even if only handshake/auth ack).
- Provide at least one integration test or smoke test that boots server and connects a client.
- Ensure CI runs lint/test/build on PR.

## Suggested minimal contract (example intent)
- client->server: "client:hello" { clientId, role, route }
- server->client: "server:hello" { serverTime, version }
- server->client: "server:error" { code, message }
- reserved for later: "race:snapshot", "race:tick", etc (types can exist but not used yet)

## PR checklist
- [ ] Contract exists and is imported in socket server setup
- [ ] Validation is in place
- [ ] Smoke/integration test included (minimal)
- [ ] CI passes
- [ ] PR title contains "M0"
