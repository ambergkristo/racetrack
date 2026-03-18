# M2 Observability Baseline

This document defines the baseline diagnostics expected in Milestone M2.

## Logging Format

Server logs are emitted as structured JSON lines with these stable top-level fields:

- `timestamp`
- `level`
- `event`

Additional event-specific fields are included to make failures actionable without scraping free-form text.

## Required Events

### Socket lifecycle

- `socket.connected`
  - emitted after a socket is accepted
  - includes `socketId` and `route`
- `socket.disconnected`
  - emitted when a socket disconnects
  - includes `socketId`, `route`, and `reason`
- `socket.auth_invalid`
  - emitted when socket handshake auth fails validation or staff key verification
  - includes `socketId`, `route`, and `reason`
- `socket.client_payload_invalid`
  - emitted when `client:hello` fails runtime validation
  - includes `socketId`, `route`, `eventName`, and `issues`
- `socket.resync_emitted`
  - emitted when the server sends the authoritative snapshot + leaderboard bundle
  - includes `delivery`, `reason`, `socketId`, `route`, `state`, `activeSessionId`, and `leaderboardSize`

### HTTP/API failure surface

- `http.staff_auth_failed`
  - emitted when a staff-gated request fails before reaching domain logic
  - includes `method`, `path`, `route`, and `reason`
- `http.domain_error`
  - emitted when a handled domain failure returns a 4xx/409 response
  - includes `method`, `path`, `code`, `status`, and `message`
- `http.internal_error`
  - emitted when an unexpected API failure returns HTTP 500
  - includes `method`, `path`, and serialized `error`

### Race runtime

- `race.timer_elapsed`
  - emitted when the timer reaches zero and the race auto-finishes
  - includes `state`

### Process lifecycle

- `server.started`
  - emitted on successful boot
  - includes `port` and `raceDurationSeconds`
- `server.start_failed`
  - emitted if boot fails
  - includes serialized `error`

## Test Coverage Expectations

M2 regression coverage must verify:

- reconnecting clients receive the authoritative snapshot and leaderboard without polling
- invalid socket payloads are rejected with explicit error surfaces
- repeated control actions do not corrupt race state and keep returning strict failures
- observability events are emitted for the error paths above
