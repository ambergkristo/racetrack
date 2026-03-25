# 00 Start Order
## Status
ACTIVE
## Goal
Määrata Dev B tööjärjekord staff route usability, workflow clarity ja demo readiness jaoks pärast lukustatud M3 baseline'i.
## Scope for This Dev
- Alusta kohe Phase 2 staff usability tööga.
- Alusta kohe Phase 3 front-desk workflow tööga paralleelselt Dev A-ga.
- Alusta kohe Phase 4 race-control clarity tööga paralleelselt Dev A-ga.
- Phase 5-s toeta Dev C public semantika kooskõla kontrolliga.
- Phase 6-s oma front-desk ja operator flow demo readiness.
## Not In Scope
- Front-desk workflow omamine Dev B asemel.
- Public display täielik omamine Dev C asemel.
- CI gate'i omamine Dev D asemel.
- Backend truth ümberkirjutamine Dev A eest.
- Uus tootescope või M3 reopen.
## Dependencies
- Phase 2: võib alustada kohe paralleelselt Dev A ja Dev C-ga.
- Phase 3: võib alustada kohe paralleelselt Dev A-ga.
- Phase 4: võib alustada kohe paralleelselt Dev A-ga.
- Phase 5: algab koos Dev C esimese public passiga.
- Phase 6: sõltub sellest, et varasemad staff flow muudatused on tõendiga olemas.
## Start Condition
- Võid alustada kohe.
- Enne Phase 5 semantikakontrolli peab Dev C-l olema esimene kasutatav public-display pass.
- Enne Phase 6 lõppkinnitust peab Dev D-l olema vähemalt üks smoke jooks või checklist draft.
## Task List
- Loe läbi kõik enda sprint failid järjekorras 01 -> 05.
- Tee Phase 2 jaoks staff usability probleemide lühiloend route kaupa.
- Tee Phase 3 jaoks front-desk workflow sammud current/next/queued vaates.
- Tee Phase 4 jaoks race-control operator path ilma selgitust vajamata.
- Phase 5 ajal kinnita staff/public semantika 1:1.
- Phase 6 ajal lukusta demoks operator flow järjekord.
## Acceptance Checks
- Iga staff route jaoks on olemas järgmine tegevus ühe pilguga loetavalt.
- Front-desk, race-control ja lap-tracker tööjärjekord on omavahel kooskõlas.
- Public semantika kontroll on eraldi märgitud, mitte segatud UI redesign'iga.
## Evidence Required
- Iga faasi kohta route verification.
- Vähemalt üks screenshot staff route kohta igas aktiivses faasis.
- PASS/FAIL readiness märge enne järgmisse faasi liikumist.
## Prompt Order Note
- Promptide järjekord Dev B jaoks: `01-PHASE-2-P0-UX-CORRECTION.md` -> `02-PHASE-3-FRONT-DESK-WORKFLOW.md` -> `03-PHASE-4-RACE-CONTROL-CLARITY.md` -> `04-PHASE-5-PUBLIC-DISPLAY-POLISH.md` -> `05-PHASE-6-DEMO-READINESS.md`.
- No scope drift: ära ava M3 uuesti, ära muuda lifecycle truth'i, ära lõhu OFF/ON flag käitumist, eelista minimaalseid kõrge väärtusega muudatusi ja lõpeta iga faas tõendiga.
