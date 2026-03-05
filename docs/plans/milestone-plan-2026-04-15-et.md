# Milestone plaan kuni 15. aprill 2026 (API-first, 4 arendajat)

## Tähtaeg
- Lõpptähtaeg: 15. aprill 2026
- Algus: 4. märts 2026
- Kestus: ~6 sprinti

## Strateegia
1. API-first ASAP:
   - esmalt serveri autoritatiivne state + socket contract + race flow
   - UI algul minimaalne, et e2e tõde kiiresti näha
2. Upgrade tee planeeritakse kohe:
   - persistence ja manual car selection liidesed abstraktsioonina algusest
   - implementatsioon feature flag’ide taha hiljem

## Rollijaotus (stabiilne)
- Dev A: backend core (state machine, timer, session/lap services, persistence adapter design)
- Dev B: staff UI’d (`/front-desk`, `/race-control`, `/lap-line-tracker`) + key gating UX
- Dev C: public UI’d (`/leader-board`, `/next-race`, `/race-countdown`, `/race-flags`) + fullscreen
- Dev D: socket event contract, validation, integration testid, observability + CI kvaliteedigate’id

## Ajakava (sprintide kaupa)

### Sprint 1 (M0) (4.03–10.03): Foundation + API skeleton
Eesmärk:
- repo scaffold, CI, route skeletonid, socket handshake
- env key check + auth delay behavior

Deliverable:
- M0 demo: kõik route’id avanevad, staff prompt enne connecti, auth success/fail töötab

Owner-fookus:
- Dev A: env/config + server bootstrap
- Dev B: staff gate UI modal
- Dev C: public route skeleton + fullscreen base
- Dev D: socket schema + CI

UI/UX integratsioon (add-only):
- Loo design system primitive’id:
  - `AppShell`
  - `Panel`
  - `TelemetryHeader`
  - `FullscreenButton`
  - `KeyGateModal`
- Rakenda shared shell kõikidele route skeletonitele.
- Staff route’del peab võtme prompt avanema enne Socket.IO ühendust.

### Sprint 2 (M0 -> M1 ettevalmistus) (11.03–17.03): Core race API ASAP (kõrgeim prioriteet)
Eesmärk:
- state machine + timer + session/racer CRUD + race-control commandid
- minimaalne snapshot feed klientidele

Deliverable:
- backend happy path töötab terminalitestidega (UI võib olla veel lihtne)

Owner-fookus:
- Dev A: domain service’d
- Dev D: event validation + integration testid
- Dev B/C: UI wire-up põhivoole

UI/UX integratsioon (add-only):
- Loo hooks:
  - `useSocket()`
  - `useRaceState()` bootstrap/snapshot
  - `useStaffGate()`
  - `useTimer()`
  - `useLeaderboard()`
  - `useFeatureFlags()`
- Lisa `ConnectionStatus` ja baastaseme veaseisud.

### Sprint 3 (M1) (18.03–24.03): MVP end-to-end
Eesmärk:
- lap crossing logic, leaderboard sorting, next-race/countdown/flags käitumine
- finished -> lock reeglid lõpuni

Deliverable:
- M1 demo: sessioonist lockini täis flow live ekraanidel

Owner-fookus:
- Dev A: lap logic lõplik
- Dev B: staff operatiivsed vaated valmis
- Dev C: public vaated live andmetega
- Dev D: e2e smoke ja regressioonitestid

UI/UX integratsioon (add-only):
- Rakenda route screenid realtime state’iga:
  - `/leader-board`: `LeaderboardScreen`, `LeaderboardTable/Row`, `FlagStatusBar`, `FullscreenButton`
  - `/race-control`: `RaceControlScreen`, `ModeSelector`, `Start/Finish/EndLock` guardid
  - `/lap-line-tracker`: `LapTrackerScreen`, `CarGrid`, `CarButtonHuge`, `SessionEndedOverlay`
  - `/next-race`: `NextRaceScreen`, `NextRaceTable`, `CallToPitBanner`, `FullscreenButton`
  - `/race-countdown`: `CountdownScreen`, `CountdownTimerBig`, `NextRaceRoster`, `SessionStatusBanner`
  - `/race-flags`: `RaceFlagsScreen`, `FlagFullScreen(mode)`, `FullscreenButton`

### Sprint 4 (M2) (25.03–31.03): Hardening + edge cases
Eesmärk:
- reconnect/resync, ebaseaduslike transitionite handling
- UX selgus (disabled state’id, errorid, loadingud)

Deliverable:
- M2 demo: robustne käitumine katkestuste ja vigade korral

Owner-fookus:
- Dev A/D: consistency + idempotency + conflict handling
- Dev B/C: UX polish, fullscreen töökindlus eri vaadetes

UI/UX integratsioon (add-only):
- Lisa reconnect/resync bannerid.
- Lisa disabled state selgitusega (miks tegevus pole lubatud).
- Lisa micro-animations ja touch feedback.
- Rakenda `FINISHED` jaoks checkered visual.
- Paranda fullscreen robustsus (desktop + tahvel).

### Sprint 5 (M3) (1.04–7.04): Upgrade architecture (ilma vaikekäitumist muutmata)
Eesmärk:
- persistence adapter interface + sqlite implementation behind flag
- manual car assignment flow behind flag
- OFF/ON testimaatriks

Deliverable:
- M3 tehniline demo: flags OFF = MVP; flags ON = upgrade behavior

Owner-fookus:
- Dev A: persistence + recovery policy
- Dev B: front-desk manual assignment UI (flag conditional)
- Dev D: flag matrix integration tests
- Dev C: public side compatibility checks

UI/UX integratsioon (add-only):
- Loo `/front-desk` `ManualCarAssignmentPanel` ainult `FF_MANUAL_CAR_ASSIGNMENT=true` korral.
- Kinnita, et flag OFF korral MVP vaikekäitumine ei muutu.
- Lisa OFF/ON UI regressioonitestid.

### Sprint 6 (Stabiliseerimine) (8.04–14.04): Stabiliseerimine + demo prep + buffer
Eesmärk:
- bugfix, test coverage gapid, demo script lukku
- riskibuffer enne 15.04

Deliverable:
- release candidate + 5–7 min Demo Day skript + fallback plaan

Owner-fookus:
- Kõik: kriitiliste vigade swarming
- Dev D: release checklist, build health, MTTR drill

UI/UX integratsioon (add-only):
- Lõplik visual consistency pass kõigil route’idel:
  - sama AppShell
  - sama tokeni kasutus
  - sama header/panel loogika
- Demo stabiliseerimine fullscreen ja reconnect stsenaariumitega.

### 15.04: Tähtaeg / esitlus
- MVP peab olema täielikult toimiv.
- Upgrade peab olema vähemalt feature-flagitud ja tehniliselt demonstreeritav.

## Milestone DoD

### M0 DoD
- CI roheline
- 6 route placeholderit
- Socket connect skeleton
- Staff pre-connect auth flow valmis

### M1 DoD
- Session/racer CRUD
- Race lifecycle commandid
- Timer dev/prod režiiimid
- Lap tracking + leaderboard sort

### M2 DoD
- Reconnect/resync
- Illegal transition handling
- Public fullscreen korrektne
- Instrumentatsioonilogid olemas

### M3 DoD
- Persistence flagitud
- Manual assignment flagitud
- Flags OFF regressioon puudub
- Restart taastumise policy rakendatud

## Kriitiline tee (critical path)
1. State machine + timer + lifecycle API
2. Lap logic + leaderboard
3. Auth gating + staff operatsioonide flow
4. E2E testid + release stabiilsus

Kui kriitiline tee hilineb:
- kärbi ainult Upgrade ulatust, mitte MVP funktsionaalset tuuma.

## Riskibuffer ja fallback
- 2 päeva bufferit (13–14 aprill) ainult kriitiliste bugfixideks.
- Kui Upgrade jääb ajahätta:
  - näita flags OFF production-ready MVP
  - näita flags ON prototüüpselt ühe end-to-end juhtumiga

## Töökorralduse reeglid
- WIP limiit: 1 aktiivne ticket arendaja kohta.
- Päevane dependency check standup’is.
- Broken main => stop-the-line kuni taastamiseni.
- PR review:
  - min 1 peer
  - state machine/socket contract muudatused min 2 peer’i

## UI/UX Coverage Matrix (add-only)
- Sprint 1 (M0) katab:
  - Design system base
  - Staff pre-connect key gate
  - Route skeleton shell
- Sprint 2 (M0 -> M1 ettevalmistus) katab:
  - Socket hooks
  - Snapshot/bootstrap vaated
  - Connection status
- Sprint 3 (M1) katab:
  - Kõik route screenid live reaalajas andmetega
- Sprint 4 (M2) katab:
  - UX hardening (reconnect, disabled-reason, animations, finished visual, fullscreen)
- Sprint 5 (M3) katab:
  - Upgrade UI flagi taga (`ManualCarAssignmentPanel`)
- Sprint 6 (Stabiliseerimine) katab:
  - UI regressioonide sulgemine + demo readiness

## No Deletion Guard (milestone)
- Kõik algsed milestone punktid on säilitatud.
- UI/UX punktid on lisatud ainult add-only põhimõttel.
- Uued lisad ei asenda ühtegi algset M0-M3 eesmärki.
