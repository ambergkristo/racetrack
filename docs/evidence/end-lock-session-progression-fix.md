# End + Lock Session Progression Fix

## Root cause of the dead-end

`lockRace()` removed the finished session and moved `activeSessionId` to the next queued session, but it left the authoritative race state in `LOCKED`.

That created a dead-end:

- the next session technically existed
- `currentSessionId` and `activeSessionId` already pointed at it
- but `startRace()` and `startSimulation()` were both blocked because they require `STAGING`

## What changed in lifecycle progression

`lockRace()` now preserves the finished session snapshot and final leaderboard, then checks whether another queued session exists.

- If no queued session exists, the lifecycle still ends in `LOCKED`
- If a queued session exists, the store immediately promotes it to the authoritative active session and transitions from `LOCKED` to `STAGING`

This keeps the next race startable without fabricating a session when the queue is empty.

## How the next queued session becomes active

When `End + Lock` runs:

1. the current finished session is copied into `lockedSession`
2. the current final leaderboard is copied into `lockedLeaderboard`
3. the finished session is removed from the live session queue
4. if another session remains, its id becomes `activeSessionId`
5. the race lifecycle transitions immediately to `STAGING`

The previous race results stay available as held results until the next race actually starts.

## Confirmation that the next session becomes STAGED

With a queued next session present, the canonical snapshot now reports:

- `state: STAGING`
- `activeSessionId` and `currentSessionId` pointing at the queued next session
- `lockedSession` still pointing at the just-finished session
- `finalResults` still exposing the previous race results

That makes both manual start and simulation start available immediately.

## Validation results

- `npm run lint` passed
- `npm test` passed
- `npm run build` passed

Additional regression coverage now checks:

- manual `End + Lock` promotes the next session to `STAGING`
- immediate restart from the promoted session works
- simulation completion also stages the next queued session instead of leaving the app in a dead-end
