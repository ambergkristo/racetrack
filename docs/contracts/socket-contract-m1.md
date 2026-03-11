# Socket Contract M1 (Realtime Lifecycle)

This document defines the active Socket.IO contract for Milestone M1.

## Scope

M1 extends the M0 baseline with active race lifecycle events:
- authoritative race snapshot stream
- timer tick stream
- leaderboard update stream
- runtime payload validation on active inbound/outbound socket events

## Event Definitions

## client -> server

### `client:hello`
Payload:
```json
{
  "clientId": "optional-string",
  "role": "optional-string",
  "route": "required-string"
}
```

Validation policy:
- validated at runtime using `clientHelloSchema`
- invalid payload returns `server:error` (`INVALID_CLIENT_HELLO`)
- unknown fields remain tolerated for backward compatibility

## server -> client

### `server:hello`
Payload shape:
- `serverTime` ISO timestamp
- `version` string (`m1`)
- `raceDurationSeconds` positive integer
- `route` non-empty string
- optional `echo`

### `server:error`
Payload shape:
- `code` non-empty string
- `message` non-empty string

### `race:snapshot`
Authoritative canonical state payload:
- `serverTime`
- `state` (`IDLE|RUNNING|FINISHED|LOCKED`)
- `mode` (`SAFE|SLOW|STOP|FINISHED`)
- `raceDurationSeconds`, `remainingSeconds`, `endsAt`
- active session pointers and full session/racer snapshots
- computed leaderboard entries

### `race:tick`
Timer payload:
- `serverTime`
- `state`
- `raceDurationSeconds`
- `remainingSeconds`
- `endsAt`

### `leaderboard:update`
Leaderboard payload:
- `serverTime`
- `state`
- `activeSessionId`
- `leaderboard` entries

## Validation Guarantees (M1)

1. Socket handshake auth input is validated at runtime (`socketAuthSchema`).
2. Active inbound socket event payloads are validated at runtime (`client:hello`).
3. Active outbound M1 lifecycle payloads are generated through schema validation:
   - `server:hello`
   - `server:error`
   - `race:snapshot`
   - `race:tick`
   - `leaderboard:update`

## Compatibility Rules

1. Event names from M0 remain stable.
2. Additive payload fields are allowed if existing fields stay compatible.
3. Field removals/renames are not allowed inside M1 without coordinated approval.
4. Polling alternatives for live updates are not allowed.

## Integration Coverage

`tests/realtime-contract.integration.test.js` covers:
- connection baseline event chain (`server:hello` -> `race:snapshot` -> `leaderboard:update`)
- schema validation of active M1 event payloads on real socket traffic
- lifecycle path across `RUNNING`, `FINISHED`, and `LOCKED` states
