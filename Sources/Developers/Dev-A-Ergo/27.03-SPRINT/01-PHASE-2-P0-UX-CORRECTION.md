# Phase 2 P0 UX Correction
## Status
ACTIVE
## Goal
Anda staff ja public UI-le puhas canonical snapshot ning vajadusel route-spetsiifilised derived field'id, et kasutaja ei peaks tõlgendama toorest süsteemiolekut.
## Scope for This Dev
- Kinnita ja vajadusel lihtsusta canonical snapshot välju:
  - `state`
  - `flag`
  - `lapEntryAllowed`
  - `activeSession`
  - `nextSession`
  - `lockedSession` või `finalResults`
- Lisa ainult need derived field'id, mida Dev B või Dev C reaalselt vajavad ühe-ekraani arusaadavuseks.
- Kirjelda backend truth nii, et race-control ja public route kasutavad sama tähendust.
## Not In Scope
- Layout või CSS töö.
- Uued route'id.
- Uus persistence arhitektuur.
- Lifecycle muutmine.
- Visuaalsed otsused, mis kuuluvad Dev B või Dev C-le.
## Dependencies
- Võib alustada kohe paralleelselt Dev B ja Dev C-ga.
- Kui lisad derived field'i, vajad Dev B või Dev C poolt konkreetset route vajadust, mitte üldist soovi.
## Start Condition
- Võid alustada kohe.
- Kui route-spetsiifiline derived field on küsitud, peab enne olema olemas:
  - Dev B või Dev C poolt näidatud route
  - proof, et praegune snapshot jätab tegevuse või staatuse mitmetimõistetavaks
## Task List
- Kaardista olemasolev snapshot ja märgi väljad, mida UI juba kasutab.
- Kirjelda iga põhilise state välja ühetähenduslik tähendus UI jaoks.
- Kontrolli, kas `nextSession` on backendist tuletatav ilma frontendi heuristikata.
- Kontrolli, kas `lockedSession` või `finalResults` peaks tulema otse backend truth'ist.
- Kirjuta välja, millised väljad on staff route jaoks, millised public route jaoks, ja millised on ühised.
- Valmista Dev D jaoks nimekiri truth-assertion'itest, mida regressioonides kontrollida.
## Acceptance Checks
- Iga vajalik UI truth väli tuleb backendist üheselt, mitte frontendi oletusena.
- `FINISHED` ja `LOCKED` ei ole andmemudelis segiaetavad.
- `nextSession` ja `activeSession` rollid on üheselt määratud.
- Derived field'e lisatakse ainult vajaduspõhiselt.
## Evidence Required
- Snapshot või API väljade tabel enne/pärast.
- Route verification märge, milline UI probleem sellega lahendati.
- PASS/FAIL märge, kas state mapping on nüüd ühetähenduslik.
## Prompt Order Note
- Käivita see enne Dev D Phase 2 regressiooni.
- Kui muudatus mõjutab `front-desk`, anna Dev B-le proof täpsest välja tähendusest.
- No scope drift: ära ava M3 uuesti, ära muuda lifecycle truth'i, ära lõhu OFF/ON flag käitumist, eelista minimaalseid kõrge väärtusega muudatusi ja lõpeta faas tõendiga.
