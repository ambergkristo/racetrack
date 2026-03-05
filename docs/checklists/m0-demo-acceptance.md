# M0 Demo Acceptance Checklist (Go/No-Go)

Use this checklist before opening Milestone M1 work.

## Rule

- Every item must be `PASS` to move from M0 to M1.
- Any `FAIL` blocks M1 start.

## 1) Deploy Health

- [ ] `GET /healthz` returns 200
- [ ] Primary URL responds

## 2) Route Availability + SPA Deep Linking

- [ ] `/front-desk` loads
- [ ] `/race-control` loads
- [ ] `/lap-line-tracker` loads
- [ ] `/leader-board` loads
- [ ] `/next-race` loads
- [ ] `/race-countdown` loads
- [ ] `/race-flags` loads
- [ ] Refresh on each route does not return 404

## 3) Staff Key Gate

- [ ] Staff route prompts for key before socket connection
- [ ] Wrong key returns error with ~500ms delay
- [ ] Correct key allows connection

## 4) Realtime Baseline

- [ ] Socket connection succeeds
- [ ] `server:hello` is received
- [ ] No polling loop used for live updates

## 5) Timer Configuration

- [ ] `npm run dev` uses 60 seconds
- [ ] `npm start` uses 600 seconds
- [ ] Optional override `RACE_DURATION_SECONDS` documented and works

## 6) CI / Quality Gate

- [ ] `npm ci` passes
- [ ] `npm run build` passes
- [ ] `npm start` smoke check passes

## 7) Documentation Gate

- [ ] `.env.example` includes required keys
- [ ] README includes local run steps
- [ ] README includes deployment URL + route list
- [ ] README includes Render deployment instructions

## Final Decision

- [ ] M0 is `GO` for milestone progression
- [ ] M0 is `NO-GO` (list blockers below)

## Blockers (if any)

- 
