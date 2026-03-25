# Phase 5 Public Display Polish
## Status
ACTIVE
## Goal
Kinnitada, et staff flow ja public flow räägivad sama semantikaga ning public polish ei lähe race-control truth'ist lahku.
## Scope for This Dev
- Kontrolli, et staff ja public route kasutavad sama state language'i.
- Kontrolli, et leaderboard ja flags ei räägi vastu sellele, mida operator näeb.
- Anna Dev C-le lühikesed semantikakorrektuurid, mitte uus disain.
## Not In Scope
- Public route lead töö.
- Fullscreen UI omamine.
- Uute public feature'ite väljamõtlemine.
- Backend truth ümberdefineerimine.
## Dependencies
- Sõltub Dev C esimesest kasutatavast public-display passist.
- Vajadusel sõltub Dev A state truth kinnitusest.
- Dev D alustab pärast Dev C esimest usable passi.
## Start Condition
- Ei alga kohe.
- Enne alustamist peab Dev C lõpetama esimese public-display passi ja andma järgmise proof'i:
  - screenshot vähemalt ühest public route'ist
  - route verification, mis kirjeldab kasutatud state language'i
## Task List
- Võrdle race-control state language'it leaderboardi, next-race, countdowni ja flags view'ga.
- Märgi vastuolud, mis võivad operatorit ja publikut eri sõnumiga jätta.
- Anna Dev C-le minimaalne semantikaparandus nimekiri.
- Kinnita, et manual assignment ega queue tekstid ei lekiks public route'idele valel kujul.
## Acceptance Checks
- Staff ja public state language on kooskõlas.
- Public route ei tõlgenda Finish/Lock tähendust ümber.
- Dev C saab semantikaparandused ilma scope'i kasvatamata.
## Evidence Required
- Võrdlev screenshot või route verification.
- Lühike PASS/FAIL märge semantikakooskõla kohta.
- Kui vastuolu leiad, täpne loetelu route + tekst + expected.
## Prompt Order Note
- Käivita pärast Dev C esimest usable public pass'i.
- Ära muuda seda faasi public redesign sprintiks; sinu roll on consistency check.
- No scope drift: ära ava M3 uuesti, ära muuda lifecycle truth'i, ära lõhu OFF/ON flag käitumist, eelista minimaalseid kõrge väärtusega muudatusi ja lõpeta faas tõendiga.
