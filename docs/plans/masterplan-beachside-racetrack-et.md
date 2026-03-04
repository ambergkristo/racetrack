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
