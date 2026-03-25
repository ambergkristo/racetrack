# Phase 3 Front Desk Workflow
## Status
ACTIVE
## Goal
Teha `/front-desk` päris operatsioonivaateks, mis toetab mitut sessiooni, current/next/queued eristust ja puhast racer workflow'd.
## Scope for This Dev
- Session queue block.
- Current session card.
- Next up card.
- Racer management ilma clutter'ita.
- Selgelt eristatud edit/delete/stage flow.
- Manual assignment UX ainult siis, kui flag ON.
## Not In Scope
- Queue truth ümberdefineerimine backendist mööda.
- Public route töö.
- Race-control clarity work.
- Uus feature scope väljaspool olemasolevat front-desk voogu.
## Dependencies
- Võib alustada kohe paralleelselt Dev A-ga.
- Vajab Dev A canonical queue truth'i, et current/next/queued märgistus oleks backendiga kooskõlas.
- Dev D alustab pärast A/B workflow muudatuste kättesaadavust.
## Start Condition
- Võid alustada kohe.
- Enne lõpliku queue UI kinnitamist peab Dev A andma proof'i:
  - current / next / queued loogika
  - mis state'is on edit/delete/stage lubatud
## Task List
- Tee queue blokk nii, et current, next ja queued on kohe eristatavad.
- Ehita current session kaart, mis näitab racerid, assigned car ja session staatust ühes plokis.
- Ehita next up kaart nii, et järgmine stardivalmis sessioon on kohe nähtav.
- Tee racer haldus voog minimaalse klikiga: edit, delete ja stage peavad olema eristuvad.
- Hoia manual assignment nähtav ainult flag ON korral ja ära lase sel queue flow'd lõhkuda.
- Anna Dev D-le konkreetsed workflow sammud testimiseks.
## Acceptance Checks
- Front desk suudab ette valmistada mitu võistlust järjest.
- Current / next / queued on kohe nähtavad.
- Manual assignment ei lõhu queue flow'd ega flag OFF baseline'i.
- Edit/delete/stage tegevused ei ole segamini.
## Evidence Required
- Screenshot current/next/queued vaatest.
- Route verification märge queue workflow kohta.
- PASS/FAIL märge, kas Dev D võib queue regressioonid käivitada.
## Prompt Order Note
- Käivita paralleelselt Dev A Phase 3 tööga.
- Ära lukusta UI tekste enne, kui Dev A truth on kinnitatud.
- No scope drift: ära ava M3 uuesti, ära muuda lifecycle truth'i, ära lõhu OFF/ON flag käitumist, eelista minimaalseid kõrge väärtusega muudatusi ja lõpeta faas tõendiga.
