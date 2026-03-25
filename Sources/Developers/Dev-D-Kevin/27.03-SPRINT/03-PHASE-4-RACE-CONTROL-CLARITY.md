# Phase 4 Race Control Clarity
## Status
ACTIVE
## Goal
Katta Phase 4 race-control clarity regressioonidega, et Start, Finish ja Lock käituksid arusaadavalt ning public mirror kasutaks sama tõde.
## Scope for This Dev
- Invalid transition coverage.
- `Finish -> post-finish lap -> lock -> blocked` flow regressioon.
- Public mirror state language kontroll.
## Not In Scope
- UI disain.
- Uue sõnavara väljamõtlemine.
- Backend state machine muutmine.
- Uute state'ide või flag'ide lisamine.
## Dependencies
- Sõltub Dev A, Dev B ja Dev C Phase 4 muudatustest.
## Start Condition
- Ei saa alustada kohe.
- Enne alustamist on vaja:
  - screenshot'i race-control vaatest
  - vähemalt ühe public mirror route'i screenshot'i või route verification'it
  - commit'i või merge'i viidet
## Task List
- Käivita invalid transition regressioon.
- Käivita `Finish -> post-finish lap -> Lock -> blocked` regressioon.
- Võrdle public mirror language'it race-control truth'iga.
- Raporteeri iga lahknevus kujul route + tekst + oodatud tulemus.
## Acceptance Checks
- Invalid transition kontrollid on rohelised.
- Finish/Lock flow on kaetud.
- Public vaated peegeldavad race-control truth'i.
- CHECKERED ja LOCKED ei ole segi aetavad.
## Evidence Required
- Testitulemus.
- Screenshot või route verification.
- PASS/FAIL märge.
## Prompt Order Note
- Alusta alles pärast Dev A, Dev B ja Dev C clarity muudatuste olemasolu.
- Tagasiside peab olema route + tekst + expected, mitte arvamus.
- No scope drift: ära ava M3 uuesti, ära muuda lifecycle truth'i, ära lõhu OFF/ON flag käitumist, eelista minimaalseid kõrge väärtusega muudatusi ja lõpeta faas tõendiga.
