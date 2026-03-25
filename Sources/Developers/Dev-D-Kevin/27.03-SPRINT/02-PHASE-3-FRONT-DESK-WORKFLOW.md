# Phase 3 Front Desk Workflow
## Status
ACTIVE
## Goal
Katta Phase 3 front-desk workflow regressioonidega pärast seda, kui Dev A ja Dev B on queue/current/next töö reaalselt kättesaadavaks teinud.
## Scope for This Dev
- Mitme sessiooni queue testid.
- `stage next` kontroll.
- Queued session'i kustutamise kontroll.
- Kontroll, et muutmine on lubatud ainult kehtivas olekus.
- Kontroll, et manual assignment ei lõhu queue flow'd, kui flag on ON.
## Not In Scope
- UI ehitamine.
- Queue truth'i defineerimine.
- Public display töö.
- Race-control redesign.
## Dependencies
- Sõltub Dev A ja Dev B Phase 3 muudatustest.
## Start Condition
- Ei saa alustada kohe.
- Enne alustamist on vaja:
  - screenshot'i current/next/queued vaatest
  - route verification'it
  - commit'i või merge'i viidet
## Task List
- Käivita queue workflow regressioonid.
- Kontrolli `stage next` voogu.
- Kontrolli queued session'i kustutamist.
- Kontrolli, et edit töötab ainult lubatud olekus.
- Kontrolli, et manual assignment flag ON ei lõhu queue flow'd.
## Acceptance Checks
- Mitme sessiooniga queue töötab.
- `stage next` säilitab loogika.
- Forbidden edit guard'id töötavad.
- Manual assignment ei lõhu front-desk workflow'd.
## Evidence Required
- Testitulemus.
- Screenshot või route verification queue flow kohta.
- PASS/FAIL märge.
## Prompt Order Note
- Alusta alles pärast Dev A ja Dev B muudatuste kättesaadavust.
- Kui UI ja truth lähevad lahku, saada tagasi täpne tõend Dev A-le või Dev B-le.
- No scope drift: ära ava M3 uuesti, ära muuda lifecycle truth'i, ära lõhu OFF/ON flag käitumist, eelista minimaalseid kõrge väärtusega muudatusi ja lõpeta faas tõendiga.
