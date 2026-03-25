# Phase 6 Demo Readiness
## Status
ACTIVE
## Goal
Lukustada front-desk ja operator flow demo jaoks nii, et live kasutaja näeb järjekorda, staging'ut ja race-control tegevust arusaadavalt.
## Scope for This Dev
- Front-desk demo flow.
- Operator flow readiness.
- Oma roll live demos.
- Koostöö Dev C ja Dev D-ga demojärjestuse kinnitamiseks.
## Not In Scope
- Release checklist omamine.
- Public route lead.
- Uue funktsionaalsuse lisamine demo nimel.
- Backend core truth ümberkirjutamine.
## Dependencies
- Vajab Phase 2–5 staff töö tõendit.
- Vajab Dev D checklist'i ja smoke script'i.
- Vajab Dev C public coherence kinnitust.
## Start Condition
- Alusta pärast seda, kui sul on vähemalt üks PASS proof front-desk ja race-control vaadetest.
- Enne lõppkinnitust peab Dev D andma:
  - demo smoke script või checklist draft
  - fallback märge, mida teha broken-main või route failure korral
## Task List
- Pane paika front-desk demo järjestus.
- Pane paika race-control operator tegevuste lühisammud.
- Kinnita, kes sisestab lap trackeris demo ajal sisendi.
- Osale vähemalt kahes kuivjooksus.
- Kirjuta üles, milline proof näitab, et operaator saab demoga hakkama ilma seletuseta.
## Acceptance Checks
- Front-desk demo flow on üheselt määratud.
- Race-control operator flow on lühike ja arusaadav.
- Kuivjooksus ei lähe current/next/queued ega Finish/Lock segi.
- Fallback sammud on teada.
## Evidence Required
- Kuivjooksu PASS/FAIL märge.
- Screenshot või video-still front-desk ja race-control demo järjestusest.
- Route verification, et demo rada on järgitav.
## Prompt Order Note
- Käivita pärast aktiivsete Phase 2–5 failide läbimist.
- Koordineeri see Dev C ja Dev D-ga, mitte isoleeritult.
- No scope drift: ära ava M3 uuesti, ära muuda lifecycle truth'i, ära lõhu OFF/ON flag käitumist, eelista minimaalseid kõrge väärtusega muudatusi ja lõpeta faas tõendiga.
