# Phase 2 P0 UX Correction
## Status
ACTIVE
## Goal
Muuta kõik staff route'id kohe kasutatavaks nii, et operaator näeb ilma scrollita, mida ta peab tegema.
## Scope for This Dev
- `/front-desk` ühe-ekraani loogika.
- `/race-control` lifecycle visual hierarchy.
- `/lap-line-tracker` ainult kriitiline info ja suured touch target'id.
- Eemalda või tihenda staff vaadete ebaoluline debug ja status tekst.
## Not In Scope
- Public route polish.
- Backend truth ümberdefineerimine.
- Uued süsteemivood väljaspool olemasolevat staff kasutust.
- Täielik disainisüsteemi redesign.
## Dependencies
- Võib alustada kohe paralleelselt Dev A ja Dev C-ga.
- Kui vajad uut truth välja, sõltud Dev A-st.
- Dev D alustab alles siis, kui esimene kasutatav staff pass on pushitud või merge'itud.
## Start Condition
- Võid alustada kohe.
- Kui staff route usability takerdub truth puuduse taha, vajad Dev A-lt proof'i:
  - milline canonical field tuleb lisada või täpsustada
  - milline route jääb praegu mitmetimõistetavaks
## Task List
- Kaardista iga staff route peamine tegevus ja eemalda seda varjav tekst.
- Tee `/front-desk` vaade loetavaks ühe 1080p ekraani sees.
- Tee `/race-control` nupud ja state nähtavaks ilma detailpaneele läbi lugemata.
- Tee `/lap-line-tracker` nii, et olulised puudutuspinnad domineerivad.
- Eemalda või tihenda debug/state read, mis ei aita järgmise tegevuse otsust.
- Anna Dev D-le route-by-route proof, millal esimene usable pass on valmis.
## Acceptance Checks
- Ükski põhiline staff vaade ei nõua 1080p peal primaarse tegevuse nägemiseks vertikaalset scrolli.
- Operaator saab aru, mida teha järgmisena.
- Lap tracker ei uputa kasutajat kõrvalinfoga.
- Debug info ei varjuta peamist tegevust.
## Evidence Required
- Screenshot kõigist kolmest staff route'ist.
- Route verification märge, mis täpselt muutus ühe-ekraani loogikas.
- PASS/FAIL märge, kas Dev D võib alustada regressiooniga.
## Prompt Order Note
- Käivita see enne Dev D Phase 2 regressiooni.
- Kui `front-desk` või `race-control` vajab uut truth välja, peata scope ja küsi see Dev A-lt konkreetse proof'iga.
- No scope drift: ära ava M3 uuesti, ära muuda lifecycle truth'i, ära lõhu OFF/ON flag käitumist, eelista minimaalseid kõrge väärtusega muudatusi ja lõpeta faas tõendiga.
