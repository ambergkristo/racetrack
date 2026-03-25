# 00 Start Order
## Status
ACTIVE
## Goal
Määrata Dev A töö järjekord 27.03 post-M3 sprinti jaoks nii, et backend truth toetaks UX-i, workflow'd ja demo't ilma M3 lukustatud käitumist lõhkumata.
## Scope for This Dev
- Alusta kohe Phase 2 backend truth tööga.
- Alusta Phase 3 queue truth tööga paralleelselt Dev B-ga.
- Alusta Phase 4 state-label truth tööga paralleelselt Dev B-ga.
- Phase 5-s ole vaikimisi mitteaktiivne, välja arvatud juhul, kui Dev C või Dev B annab explicit backend support vajaduse.
- Phase 6-s toeta backend truth'i ja viimaseid demo jaoks vajalikke selgitavaid täpsustusi.
## Not In Scope
- M3 reopen.
- Uus persistence scope.
- Uued lifecycle transitions.
- UI layouti juhtimine Dev B või Dev C eest.
- Feature flag käitumise ümbermõtestamine.
## Dependencies
- Phase 2: võib alustada kohe paralleelselt Dev B ja Dev C-ga.
- Phase 3: võib alustada kohe paralleelselt Dev B-ga.
- Phase 4: võib alustada kohe paralleelselt Dev B-ga.
- Phase 5: oota ainult siis, kui Dev C või Dev B küsib backend support'i ja toob konkreetse puudujäägi.
- Phase 6: alusta, kui Phase 2–5 põhivood on tõendiga kaetud.
## Start Condition
- Võid alustada kohe.
- Enne Phase 5 backend tuge on vaja Dev C või Dev B poolt tõendit:
  - milline route vajab uut derived field'i või täpsemat state truth'i
  - screenshot või route verification, mis näitab puudujääki
## Task List
- Loe enne tööd läbi kõik enda 27.03 sprint failid järjekorras 01 -> 05.
- Tee Phase 2 jaoks snapshot/view-model truth nimekiri.
- Tee Phase 3 jaoks queue/current/next ordering reeglite nimekiri.
- Tee Phase 4 jaoks FINISHED vs LOCKED semantika eristuse kontrollnimekiri.
- Hoia Phase 5 reserveeritud ainult explicit backend support jaoks.
- Phase 6 ajal anna Dev D-le backend truth kontrollpunktid demo scripti jaoks.
## Acceptance Checks
- Phase 2, 3 ja 4 algusjärjekord on üheselt arusaadav.
- Üheski faasis ei ole sul luba muuta lifecycle truth'i ilma eraldi põhjenduseta.
- Phase 5 passiivsus on selgelt märgitud.
- Phase 6 backend support on seotud konkreetse demo või truth vajadusega.
## Evidence Required
- Link või märge igale oma faasidokumendile.
- Töö alguses lühike PASS/FAIL readiness märge iga faasi kohta.
- Kui Phase 5 aktiveerub, konkreetne screenshot või route verification põhjendus.
## Prompt Order Note
- Promptide järjekord Dev A jaoks: `01-PHASE-2-P0-UX-CORRECTION.md` -> `02-PHASE-3-FRONT-DESK-WORKFLOW.md` -> `03-PHASE-4-RACE-CONTROL-CLARITY.md` -> vajadusel `04-PHASE-5-PUBLIC-DISPLAY-POLISH.md` -> `05-PHASE-6-DEMO-READINESS.md`.
- No scope drift: ära ava M3 uuesti, ära muuda lifecycle truth'i, ära lõhu OFF/ON flag käitumist, eelista minimaalseid kõrge väärtusega muudatusi ja lõpeta iga faas tõendiga.
