# Phase 3 Front Desk Workflow
## Status
ACTIVE
## Goal
Tagada backendis üheselt tõene queue/current/next mudel, mille peale Dev B saab ehitada päris front-desk workflow.
## Scope for This Dev
- Canonical queue ordering rules.
- `current`, `next`, `queued` eristus backend truth'is.
- Guards:
  - duplicate name
  - invalid edit
  - forbidden state edit
- Manual assignment peab flag ON korral sobituma queue flow'ga ilma flag OFF baseline'i muutmata.
## Not In Scope
- Front-desk layouti kujundus.
- Uued administraatori vood väljaspool olemasolevat scope'i.
- Race-control käitumise muutmine.
- Public route töö.
## Dependencies
- Võib alustada kohe paralleelselt Dev B-ga.
- Vajab Dev B-ga kiiret kooskõlastust, milliseid queue semantilisi silte UI vajab.
- Dev D saab alustada alles pärast A/B muutuste kättesaadavust.
## Start Condition
- Võid alustada kohe.
- Enne queue truth lõpetamist on vaja Dev B-lt kinnitust:
  - millised plokid peavad ekraanil eristuma: current / next / queued
  - milline proof näitab, et info on nüüd ühe pilguga loetav
## Task List
- Määra queue ordering reegel, mida frontend ei pea ise tuletama.
- Määra, millal session on `current`, millal `next`, millal `queued`.
- Vaata üle delete/edit/stage lubatavus eri state'ides.
- Kinnita, et manual assignment ei muuda queue truth'i ega järjestust.
- Anna Dev D-le kontrollitav loogikaloend: stage next, delete queued, edit only valid state.
## Acceptance Checks
- Current/next/queued on backend truth'is ühesed.
- Keelatud edit'id annavad lühikese ja kontrollitava guard'i.
- Manual assignment ei murra queue flow'd.
- Dev B ei pea queue tähendust frontendis oletama.
## Evidence Required
- Reeglite loetelu või API proof current/next/queued kohta.
- Vähemalt üks testitulemus või route verification, mis katab queue flow'd.
- PASS/FAIL märge, kas workflow truth on valmis Dev D regressiooniks.
## Prompt Order Note
- Käivita paralleelselt Dev B Phase 3 tööga.
- Dev D Phase 3 prompt käivitub alles pärast seda, kui A/B muudatused on pushitud või merge'itud.
- No scope drift: ära ava M3 uuesti, ära muuda lifecycle truth'i, ära lõhu OFF/ON flag käitumist, eelista minimaalseid kõrge väärtusega muudatusi ja lõpeta faas tõendiga.
