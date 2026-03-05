# Socket Contract M0 (Baseline Freeze)

This document defines the minimal Socket.IO contract for Milestone M0.

## Scope

M0 contract is intentionally small:
- handshake baseline
- basic server error message shape
- reserved event names for later milestones

No race domain logic is required in M0 contract.

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
- `route` is required
- unknown fields are tolerated in M0
- invalid payload should not crash server

## server -> client

### `server:hello`
Payload:
```json
{
  "serverTime": "ISO-string",
  "version": "string",
  "raceDurationSeconds": 60,
  "route": "/front-desk",
  "echo": {}
}
```

Notes:
- `echo` is optional
- this event confirms baseline socket health

### `server:error`
Payload:
```json
{
  "code": "string",
  "message": "string"
}
```

Notes:
- keep error shape stable in M0

## Reserved For M1+

These names may exist as types/placeholders but are not required to be active in M0:
- `race:snapshot`
- `race:tick`
- `leaderboard:update`

## Compatibility Rules

1. Event names listed above are frozen for M0 unless Dev C approves change.
2. Payload additions must be backward compatible.
3. Removing fields during M0 is not allowed.
4. Polling alternatives for live updates are not allowed.

## Ownership

- Dev D owns schema/validation baseline.
- Dev C approves contract-level changes before merge to `main`.
