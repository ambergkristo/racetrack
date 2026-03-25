# 00 Start Order
## Status
ACTIVE
## Goal
Määrata Dev C tööjärjekord public usability, state language mirror'i ja demo koherentsi jaoks pärast lukustatud M3 baseline'i.
## Scope for This Dev
- Alusta kohe Phase 2 public usability tööga.
- Phase 3-s ole vaikimisi mitteaktiivne, välja arvatud väike compatibility note.
- Phase 4-s alusta pärast või Dev B töö lõppfaasis, et peegeldada sama state language'it public route'idele.
- Phase 5-s juhi public display polish sprinti.
- Phase 6-s oma public demo coherence.
## Not In Scope
- Front-desk workflow omamine Dev B asemel.
- Backend truth muutmine Dev A asemel.
- Release checklist omamine Dev D asemel.
- Uus tootescope või M3 reopen.
- Staff usability juhtimine.
## Dependencies
- Phase 2: võib alustada kohe paralleelselt Dev A ja Dev B-ga.
- Phase 3: mitteaktiivne, välja arvatud vajaduspõhine compatibility note.
- Phase 4: sõltub Dev B ja Dev A state language'i stabiliseerimisest.
- Phase 5: juhib, Dev B toetab, Dev D alustab pärast esimest usable passi.
- Phase 6: sõltub, et public route'id on vähemalt ühe PASS iteration'iga kaetud.
## Start Condition
- Phase 2-ga võid alustada kohe.
- Phase 4 ei tohi alata enne, kui Dev B ja Dev A annavad proof'i:
  - race-control state language
  - FINISHED ja LOCKED eristus
- Phase 5 lead algab siis, kui Phase 2 public usability pass on tehtud.
## Task List
- Loe läbi kõik enda sprint failid järjekorras 01 -> 05.
- Tee Phase 2 jaoks public route usability audit.
- Hoia Phase 3 faili mitteaktiivse compatibility note jaoks valmis.
- Tee Phase 4 jaoks mirror language checklist.
- Juhi Phase 5 public polish'i ja lukusta Phase 6 demo coherence.
## Acceptance Checks
- Phase 2, 4, 5 ja 6 järjekord on selge.
- Phase 3 mitteaktiivsus on üheselt kirjas.
- Public language ei lähe staff truth'ist lahku.
## Evidence Required
- Route-by-route screenshot või verification aktiivsetes faasides.
- PASS/FAIL readiness märge enne järgmisse faasi liikumist.
- Kui Phase 3 aktiveerub, konkreetne compatibility proof.
## Prompt Order Note
- Promptide järjekord Dev C jaoks: `01-PHASE-2-P0-UX-CORRECTION.md` -> vaikimisi skip `02-PHASE-3-FRONT-DESK-WORKFLOW.md` -> `03-PHASE-4-RACE-CONTROL-CLARITY.md` -> `04-PHASE-5-PUBLIC-DISPLAY-POLISH.md` -> `05-PHASE-6-DEMO-READINESS.md`.
- No scope drift: ära ava M3 uuesti, ära muuda lifecycle truth'i, ära lõhu OFF/ON flag käitumist, eelista minimaalseid kõrge väärtusega muudatusi ja lõpeta iga faas tõendiga.
