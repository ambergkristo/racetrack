# Milestone plaan kuni 15. aprill 2026 (API-first, 4 arendajat)

## Tähtaeg
- Lõpptähtaeg: 15. aprill 2026
- Algus: 4. märts 2026
- Kestus: ~6 nädalat

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

## Ajakava (nädalate kaupa)

### Nädal 1 (4.03–10.03): Foundation + API skeleton
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

### Nädal 2 (11.03–17.03): Core race API ASAP (kõrgeim prioriteet)
Eesmärk:
- state machine + timer + session/racer CRUD + race-control commandid
- minimaalne snapshot feed klientidele

Deliverable:
- backend happy path töötab terminalitestidega (UI võib olla veel lihtne)

Owner-fookus:
- Dev A: domain service’d
- Dev D: event validation + integration testid
- Dev B/C: UI wire-up põhivoole

### Nädal 3 (18.03–24.03): MVP end-to-end
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

### Nädal 4 (25.03–31.03): Hardening + edge cases
Eesmärk:
- reconnect/resync, ebaseaduslike transitionite handling
- UX selgus (disabled state’id, errorid, loadingud)

Deliverable:
- M2 demo: robustne käitumine katkestuste ja vigade korral

Owner-fookus:
- Dev A/D: consistency + idempotency + conflict handling
- Dev B/C: UX polish, fullscreen töökindlus eri vaadetes

### Nädal 5 (1.04–7.04): Upgrade architecture (ilma vaikekäitumist muutmata)
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

### Nädal 6 (8.04–14.04): Stabiliseerimine + demo prep + buffer
Eesmärk:
- bugfix, test coverage gapid, demo script lukku
- riskibuffer enne 15.04

Deliverable:
- release candidate + 5–7 min Demo Day skript + fallback plaan

Owner-fookus:
- Kõik: kriitiliste vigade swarming
- Dev D: release checklist, build health, MTTR drill

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
