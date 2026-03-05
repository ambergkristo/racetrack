# Beachside Racetrack – Masterplan (ET)

## 1. Eesmärk
Ehita reaalajas võistlusjuhtimise süsteem (Node.js + Socket.IO), kus:
- staff route’id on võtmega kaitstud enne socket connecti,
- server on autoritatiivne oleku- ja taimeriallikas,
- avalikud ekraanid uuenevad ainult Socket.IO kaudu (polling puudub),
- MVP valmib kiiresti (in-memory, random/auto car assignment),
- Upgrade lisab persistence + admini käsitsi auto valiku feature flag’ide taha ilma vaikekäitumist muutmata.

## 2. MVP ulatus
MVP sisaldab:
- Route’id:
  - `/front-desk`
  - `/race-control`
  - `/lap-line-tracker`
  - `/leader-board`
  - `/next-race`
  - `/race-countdown`
  - `/race-flags`
- Socket.IO reaalajas sündmused kogu live state jaoks.
- Staff võtmevärav per route enne socketit.
- Server ei käivitu, kui võtmed puuduvad.
- Vale võtme vastus viibib 500ms.
- Session/racer CRUD front-desk’is.
- Racer name unikaalsus sessiooni sees.
- Race-control:
  - start
  - mode: SAFE / HAZARD_SLOW / HAZARD_STOP
  - finish
  - end/lock
- Lap tracker:
  - per car: `lastCrossingTimestamp`, `currentLapTime`, `bestLapTime`, `lapCount`
  - esimene crossing alustab lap 1
  - iga crossing suurendab lapCount
- Leaderboard:
  - sort `bestLapTime` asc
  - no-time read lõppu
- Finished käitumine:
  - crossings lubatud FINISHED olekus
  - pärast END/LOCK sisend keelatud
- Public route’idel Fullscreen nupp.
- MVP-s mineviku sõidud eemaldatakse aktiivsest nimekirjast.

MVP non-goals:
- persistence restartide vahel
- admin manual car selection
- ajalooline analytics dashboard

## 3. Upgrade ulatus (feature flag)
- `FF_PERSISTENCE=true` => state taastub restarti järel.
- `FF_MANUAL_CAR_ASSIGNMENT=true` => admin valib autod käsitsi.
- Vaikimisi mõlemad `false`.
- Flag’id väljas => käitumine identne MVP-ga.

## 4. Tehniline arhitektuur
- Node.js server (Express + Socket.IO).
- Autoritatiivne server-state + race timer.
- Thin clients route-põhiste view-model’idega.
- Room strateegia:
  - `public.all`
  - `staff.frontdesk`
  - `staff.racecontrol`
  - `staff.laptracker`
  - vajadusel `session.<id>`

## 5. Race state machine
Olekud:
- `IDLE`
- `STAGING`
- `RUNNING`
- `FINISHED`
- `LOCKED`

Üleminekud:
- IDLE -> STAGING
- STAGING -> RUNNING
- RUNNING -> RUNNING (mode switch)
- RUNNING -> FINISHED
- FINISHED -> LOCKED
- LOCKED -> STAGING (järgmine sessioon)

Guard:
- FINISHED/LOCKED -> RUNNING on keelatud.
- Lap input lubatud ainult RUNNING/FINISHED.

## 6. Taimer
- Server-authoritative.
- `npm run dev` => 60s.
- `npm start` => 600s.
- Tick every 1s (`race:tick`).
- Timer 0 korral auto-finish RUNNING -> FINISHED.

## 7. Turve
- ENV võtmed:
  - `FRONT_DESK_KEY`
  - `RACE_CONTROL_KEY`
  - `LAP_LINE_TRACKER_KEY`
- Puuduv key => startup fail.
- Vale key => generic error + 500ms delay.
- Staff token mälus (mitte localStorage).

## 8. Realtime lepingu tuum
Peamised eventid:
- `auth:join_staff`, `auth:joined_staff`
- `state:bootstrap`, `state:snapshot`
- `session:create|update|delete`
- `racer:add|update|remove`
- `race:start`
- `race:mode:set`
- `race:finish`
- `race:end_lock`
- `lap:crossing`
- `race:tick`
- `leaderboard:update`
- `ui:error`

Reegel:
- pollingut ei kasutata live state uuenduseks.

## 9. Toote mõõdikud
North Star:
- `% sessioonidest, mis algavad <=3 min jooksul ja lõppevad 0 vaidlustatud lap eventiga`

Input metricud:
- setup error rate
- median time-to-start
- lap correction count/session
- flag update latency p95

## 10. Kvaliteet
- Unit: state machine, lap logic, timer.
- Integration: socket flow, auth delay, guards.
- E2E: MVP happy path kogu lifecycle.
- Feature-flag matrix: OFF/ON regressioonikontroll Upgrade’is.

## 11. Tiimimudel (4 arendajat)
- Dev A: server domain, state machine, timer, persistence.
- Dev B: staff UI + auth UX.
- Dev C: public UI + fullscreen.
- Dev D: socket contract, testid, observability.
- Mentor: advisory only (task owner ei ole).

## 12. Deliverables
- MVP demo-ready enne deadline’i.
- Upgrade branch/flag valmidus (võib olla osaliselt viimistlemisel, kuid arhitektuuriliselt valmis).
- Demo script 5–7 min.

## 13. UI/UX Design System (autoritatiivne)
- Teema: modern racing/telemetry dashboard, dark mode, high contrast, neon aktsendid, fullscreen-friendly.
- Värvitokenid:
  - background `#0b0b0f`
  - panel `#16161c`
  - safe `#00ff7b`
  - warning `#ffd400`
  - danger `#ff2e2e`
  - finished `checkered pattern`
- Fondid:
  - pealkirjad `Orbitron`
  - UI/body `Rajdhani`
- Touch target reeglid:
  - staff nupud min kõrgus `56px`
  - lap tracker auto nupud `120–160px`
- Ühtne stiil kõikidel route’idel:
  - sama `AppShell`
  - sama `TelemetryHeader`
  - sama paneeli visuaal (`Panel`)

## 14. UI komponentide kaart (kohustuslik)
- Shared komponendid:
  - `AppShell`
  - `Panel`
  - `TelemetryHeader`
  - `KpiPill`
  - `Button` variandid (`Primary`, `Danger`, `Warning`, `Ghost`, `HugeTouch`)
  - `FullscreenButton`
  - `ConnectionStatus`
  - `Toast` või `InlineAlert`
  - `LoadingSkeleton`
  - `EmptyState`
  - `Divider` ja `Table`
- Staff gate:
  - `KeyGateModal(routeKeyName)` kuvab võtme prompti enne socket ühendust
  - Vale võti kuvab vea ning peab järgima serveri 500ms viivituskäitumist
  - Socket ühendus luuakse alles pärast edukat valideerimist
- Hooks:
  - `useSocket()`
  - `useStaffGate()`
  - `useRaceState()`
  - `useTimer()`
  - `useLeaderboard()`
  - `useFeatureFlags()`

## 15. Route-põhine UI leping
- `/leader-board`:
  - `LeaderboardScreen`
  - `LeaderboardTable` / `LeaderboardRow`
  - `FlagStatusBar`
  - `FullscreenButton`
- `/race-flags`:
  - `RaceFlagsScreen`
  - `FlagFullScreen(mode)`
  - `FullscreenButton`
- `/race-countdown`:
  - `CountdownScreen`
  - `CountdownTimerBig`
  - `NextRaceRoster`
  - `SessionStatusBanner`
- `/next-race`:
  - `NextRaceScreen`
  - `NextRaceTable`
  - `CallToPitBanner`
  - `FullscreenButton`
- `/race-control`:
  - `RaceControlScreen`
  - `ModeSelector(SAFE/SLOW/STOP)`
  - `Start/Finish/EndLock` tegevused guardidega
- `/lap-line-tracker`:
  - `LapTrackerScreen`
  - `CarGrid`
  - `CarButtonHuge`
  - `SessionEndedOverlay` (`LOCKED` olekus blokeerib sisendi)
- `/front-desk`:
  - `FrontDeskScreen`
  - `SessionsList`
  - `SessionEditor`
  - `RacerList` CRUD
  - `ManualCarAssignmentPanel` ainult `FF_MANUAL_CAR_ASSIGNMENT=true` korral

## 16. Realtime UI piirangud ja MVP pariteet
- Live state update jaoks pollingut ei kasutata.
- Lubatud on ainult esmane handshake/bootstrap API; kõik ülejäänud uuendused peavad tulema Socket.IO kaudu.
- Kõik staff route’id peavad küsima võtme enne socket connecti.
- Kõik public route’id peavad sisaldama fullscreen nuppu.
- Kui feature flagid on OFF, UI käitumine peab olema identne MVP-ga.
- Upgrade UI tohib aktiveeruda ainult flagi all:
  - `FF_MANUAL_CAR_ASSIGNMENT`
  - `FF_PERSISTENCE`

## 17. Milestone sidumine UI/UX tööga (tähtaeg 15.04.2026)
- M0 / Nädal 1:
  - design system primitive’id (`AppShell`, `Panel`, `TelemetryHeader`, `FullscreenButton`, `KeyGateModal`)
  - route skeleton lehed shared shelliga
  - staff key gate enne socket connecti
- Nädal 2:
  - socket hooks (`useSocket`, `useRaceState` bootstrap/snapshot)
  - `ConnectionStatus` + baastaseme veaseisud
- M1 / Nädal 3:
  - reaalsed route screenid ühendatud realtime state’iga
- M2 / Nädal 4:
  - reconnect/resync bannerid
  - disabled state põhjusega
  - micro-animations
  - finished checkered visual
  - fullscreen robustness
- M3 / Nädal 5:
  - `/front-desk` manual car assignment panel ainult flagi taga
- Nädal 6:
  - regressioonide sulgemine ja demo stabiliseerimine

## 18. Avalikud UI lepingud (API/tüübid)
- `RaceMode = "SAFE" | "HAZARD_SLOW" | "HAZARD_STOP" | "FINISHED"`
- `RaceState = "IDLE" | "STAGING" | "RUNNING" | "FINISHED" | "LOCKED"`
- `StaffRoute = "front-desk" | "race-control" | "lap-line-tracker"`
- `FeatureFlags = { FF_PERSISTENCE: boolean; FF_MANUAL_CAR_ASSIGNMENT: boolean }`
- `useStaffGate()`:
  - input: `routeKeyName`, `routeId`
  - output: `authorized`, `authorize(key)`, `isChecking`, `error`
  - garantii: socket connect ainult `authorized=true` järel

## 19. UI testikriteeriumid
- Unit:
  - `useStaffGate` ei loo socketit enne edukat võtme valideerimist
  - feature flag OFF/ON render-käitumine on korrektne
  - design tokenid laetakse kõigis route’ides
- Integration:
  - vale võti -> serveri viga + kordusprompt
  - `state:snapshot` jõuab route vaadetesse
  - `LOCKED` olek blokeerib lap inputi
- E2E:
  - public route’idel fullscreen nupp toimib
  - race mode visualid (SAFE/SLOW/STOP/FINISHED) renderduvad ühtselt
  - reconnect/resync taastab vaated ilma pollinguta
  - flagid OFF jätavad MVP käitumise muutmata

## 20. No-Loss reegel milestone sisule
- Ühtegi olemasolevat milestone punkti ei kustutata.
- Uus UI/UX töö lisatakse milestone ploki alla add-only põhimõttel.
- Kui tekib uus UI nõue, lisatakse see:
  - vastava nädala alla
  - koos owneriga
  - koos DoD tõendiga (screenshot/demo/test).
