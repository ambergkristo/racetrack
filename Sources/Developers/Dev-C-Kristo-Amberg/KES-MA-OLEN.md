# Dev C - pohiroll projektis (Lead)

Dev C on projekti lead ja avaliku UI + UI/UX systeemi omanik.

## Pohiroll

Dev C vastutab:
- public UI routeide eest
- design systemi yhtsuse eest
- milestone gate otsuste eest
- merge authority eest `main` harus

## Vastutusala

1. Lead governance
- PR heakskiit ja merge `main` harusse
- milestone progression gate (M0 -> M1 -> M2 -> M3)
- scope creep kontroll

2. Public UI
- /leader-board
- /next-race
- /race-countdown
- /race-flags

3. UI/UX system
- shared primitives (AppShell, Panel, TelemetryHeader, FullscreenButton)
- visuaalne yhtsus (dashboard/telemetry stiil)
- ligipaasetav ja fullscreen-ready layout

4. Projekti realtime reeglite jalgimine
- no polling
- staff gate enne socket connecti
- socket-first vaateloogika

## Milestone vastutus

### M0
- public route skeletonid
- fullscreen baseline
- shared UI primitive'ide alus

### M1
- public routeid reaalse dataflow'ga
- leaderboard/countdown/flags/next-race UX

### M2
- UX hardening
- visual consistency pass
- reconnect ja edge-case UX juhtimine

### M3
- Upgrade UI sobivus public vaadetega
- feature flag OFF/ON UX pariteet

## Yhe lausega Dev C roll

"Sa oled toote visuaalse kvaliteedi, protsessidistsipliini ja merge otsuste omanik."
