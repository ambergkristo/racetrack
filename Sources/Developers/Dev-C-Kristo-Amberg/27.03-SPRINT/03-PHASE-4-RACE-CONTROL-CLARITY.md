# Phase 4 Race Control Clarity
## Status
ACTIVE
## Goal
Peegeldada public route'ides sama state language ja flag semantics, mida race-control kasutab, et publik ja operaator näeksid sama tõde.
## Scope for This Dev
- Sama state language public route'idel.
- Sama flag semantics leaderboardi ja flags view' vahel.
- Vajadusel väike flag indicator row või header tasemel.
## Not In Scope
- Race-control nupulogika ehitamine.
- Backend truth muutmine.
- Uute state'ide lisamine.
- Front-desk workflow.
## Dependencies
- Ei tohi alata enne, kui Dev B ja Dev A on race-control truth'i praktiliselt lukustanud.
- Dev D alustab pärast A/B/C muudatuste kättesaadavust.
## Start Condition
- Oota Dev B ja Dev A proof'i:
  - race-control state language
  - FINISHED vs LOCKED eristus
  - route verification või screenshot, mis näitab lõplikku kasutatavat race-control passi
## Task List
- Võrdle public route tekste race-control state language'iga.
- Ühtlusta `CHECKERED`, `LOCKED`, mode ja state tähendused leaderboardi, countdowni ja flags vaates.
- Lisa ainult minimaalne flag indicator seal, kus see parandab arusaadavust.
- Väldi lisamast visuaalset müra, mis vähendab loetavust.
- Anna Dev D-le loetelu route'idest, kus state mirror peab olema regressiooniga kaetud.
## Acceptance Checks
- Public ja race-control räägivad sama state keelt.
- Leaderboard ja flags ei anna vastuolulist signaali.
- `FINISHED` ja `LOCKED` on public route'il eristatavad.
- Kõik lisad on minimaalset kasu andvad, mitte dekoratiivsed.
## Evidence Required
- Screenshot vähemalt kahest public route'ist enne/pärast.
- Route verification state mirror kohta.
- PASS/FAIL märge, kas Dev D võib clarity regressiooni käivitada.
## Prompt Order Note
- Käivita pärast seda, kui Dev B Phase 4 on kasutatav või lõppfaasis.
- Ära tee seda oletuste põhjal; kasuta A/B poolt kinnitatud state language'it.
- No scope drift: ära ava M3 uuesti, ära muuda lifecycle truth'i, ära lõhu OFF/ON flag käitumist, eelista minimaalseid kõrge väärtusega muudatusi ja lõpeta faas tõendiga.
