# Phase 6 Demo Readiness
## Status
ACTIVE
## Goal
Lukustada public screens demo jaoks nii, et vaataja näeb kohe koherentset lugu race state'ist, countdown'ist ja tulemuse flow'st.
## Scope for This Dev
- Public demo coherence.
- Public route järjestus demo ajal.
- Kooskõla Dev B operator flow ja Dev D smoke/fallback plaaniga.
## Not In Scope
- Release checklist omamine.
- Front-desk flow omamine.
- Uue feature'i lisamine demo tarbeks.
- Backend truth ümbertegemine.
## Dependencies
- Vajab, et public route'id on vähemalt ühe PASS iteration'iga valmis.
- Vajab Dev D checklist'i ja smoke skripti.
- Vajab Dev B operator flow järjekorda.
## Start Condition
- Alusta pärast Phase 5 tõendit.
- Enne lõppkinnitust peab Dev D andma:
  - demo smoke script
  - fallback note
- Enne public story lukustamist peab Dev B andma operator flow järjekorra, millega public vaated peavad kooskõlas olema.
## Task List
- Pane paika public route demo järjekord.
- Kinnita, millised public route'id on demo ajal primaarse tähtsusega.
- Tee vähemalt kaks kuivjooksu public screens koherentsi vaates.
- Märgi ära, milline on fallback, kui fullscreen või mõni üksik route jookseb kokku.
## Acceptance Checks
- Public screens jutustavad demo ajal ühe loo.
- Vaataja saab aru, mis seis võistlusel parasjagu on.
- Dry run ei vaja lisaselgitusi, et aru saada public ekraanidest.
- Fallback on teada ja lühike.
## Evidence Required
- Kuivjooksu PASS/FAIL märge.
- Screenshot või video-still public route järjestusest.
- Route verification, milline ekraan millal demosse läheb.
## Prompt Order Note
- Käivita pärast Phase 4 ja 5 public route proof'i.
- Koordineeri see Dev B ja Dev D-ga, et demo lugu oleks tervik.
- No scope drift: ära ava M3 uuesti, ära muuda lifecycle truth'i, ära lõhu OFF/ON flag käitumist, eelista minimaalseid kõrge väärtusega muudatusi ja lõpeta faas tõendiga.
