# Phase 6 Demo Readiness
## Status
ACTIVE
## Goal
Lukustada release checklist, smoke script ja fallback-plaan 5-7 minuti demo jaoks nii, et sprint lõpeks tõendatud demo-valmidusega.
## Scope for This Dev
- Release checklist.
- Build health kontroll.
- Broken-main fallback plaan.
- Smoke test script.
- Kahe kuivjooksu tõendite koondamine.
## Not In Scope
- UI juhtimine Dev B või Dev C eest.
- Backend truth'i defineerimine Dev A eest.
- Uued feature'id.
- Visuaalne polish väljaspool smoke'i ja readiness proof'i.
## Dependencies
- Vajab kõigi teiste arendajate Phase 2-5 tõendeid.
- Kõik panustavad, aga Dev D omab checklist'i, smoke'i ja fallback'i.
## Start Condition
- Alusta siis, kui Phase 2-5 kohta on vähemalt esialgne PASS/FAIL tõend olemas.
- Enne lõplikku readiness hinnangut peavad teised dev'id andma:
  - screenshot'i
  - testitulemuse või route verification'i
  - PASS/FAIL märke
## Task List
- Koosta release checklist.
- Kirjuta smoke script.
- Kirjuta broken-main fallback plaan.
- Kontrolli build health'i.
- Käivita või koordineeri vähemalt kaks täis kuivjooksu.
- Anna lõplik PASS/FAIL readiness hinnang.
## Acceptance Checks
- Checklist on täidetav ja konkreetne.
- Smoke script on lühike ja operatiivne.
- Fallback on selge ega lõhu truth baseline'i.
- Kaks kuivjooksu on tehtud ja tõendatud.
## Evidence Required
- Checklist.
- Smoke script.
- Kuivjooksu PASS/FAIL märge.
- Build health märge.
## Prompt Order Note
- See on Dev D viimane prompt.
- Koonda kokku tõendid, mitte arvamused.
- No scope drift: ära ava M3 uuesti, ära muuda lifecycle truth'i, ära lõhu OFF/ON flag käitumist, eelista minimaalseid kõrge väärtusega muudatusi ja lõpeta faas tõendiga.
