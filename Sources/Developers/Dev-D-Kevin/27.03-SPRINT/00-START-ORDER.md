# 00 Start Order
## Status
ACTIVE
## Goal
Määrata Dev D tööjärjekord 27.03 post-M3 sprinti jaoks nii, et ta testiks päris muudatusi, mitte baseline'i, ja lõpetaks sprinti release checklist'i, smoke'i ning fallback-plaaniga.
## Scope for This Dev
- Phase 2 regressiooni- ja truth-katte töö pärast seda, kui Dev A, Dev B ja Dev C esimene kasutatav pass on pushitud või merge'itud.
- Phase 3 front-desk workflow regressioon pärast Dev A ja Dev B queue/current/next muudatusi.
- Phase 4 transition regression pärast Dev A, Dev B ja Dev C clarity muudatusi.
- Phase 5 fullscreen smoke ja readability proof pärast Dev C esimest kasutatavat public-display passi.
- Phase 6 release checklist'i, smoke script'i ja fallback-plaani omamine.
## Not In Scope
- UI juhtimine Dev B või Dev C eest.
- Backend truth'i defineerimine Dev A eest.
- Uute feature'ite lisamine.
- M3 uuesti avamine.
- Layout'i või süsteemi ümberdisain.
## Dependencies
- Phase 2: oota, kuni Dev A, Dev B ja Dev C on vähemalt ühe kasutatava UI või API muudatuse pushinud või merge'inud.
- Phase 3: oota, kuni Dev A ja Dev B front-desk workflow muudatused on kättesaadavad.
- Phase 4: oota, kuni Dev A, Dev B ja Dev C clarity muudatused on kättesaadavad.
- Phase 5: oota, kuni Dev C esimene kasutatav public-display pass on olemas.
- Phase 6: tööta koos kõigiga, aga oma ise checklist'i, smoke'i ja fallback'i.
## Start Condition
- Ühtegi aktiivset faasi ei tohi alustada enne, kui on olemas midagi päriselt testitavat.
- Enne iga aktiivse faasi algust on vaja:
  - screenshot'i või route verification'it
  - commit'i, push'i või merge'i viidet
  - lühikest märkust selle kohta, mida täpselt testida tuleb
## Task List
- Loe enne tööd läbi kõik enda 27.03 sprint failid järjekorras 01 -> 05.
- Kinnita enne iga faasi, et branch või `main` sisaldab testitavat muudatust.
- Käivita regressioonid alles siis, kui kasutatav pass on tõendiga olemas.
- Hoia Phase 6 release checklist'i mustandit jooksvalt ajakohasena.
## Acceptance Checks
- Ühtegi regressiooni ei joosta vaakumis.
- Iga regressioon on seotud päriselt kättesaadava muudatusega.
- Phase 6 checklist koondab kogu sprinti tõendid üheks kasutatavaks paketiks.
## Evidence Required
- Tõend selle kohta, mida täpselt testiti.
- PASS/FAIL märge iga faasi lõpus.
- Testitulemus, screenshot ja route verification kõigi aktiivsete faaside kohta.
## Prompt Order Note
- Promptide järjekord Dev D jaoks: `01-PHASE-2-P0-UX-CORRECTION.md` -> `02-PHASE-3-FRONT-DESK-WORKFLOW.md` -> `03-PHASE-4-RACE-CONTROL-CLARITY.md` -> `04-PHASE-5-PUBLIC-DISPLAY-POLISH.md` -> `05-PHASE-6-DEMO-READINESS.md`.
- Ära käivita regressiooni enne, kui vastav faas on reaalselt olemas.
- No scope drift: ära ava M3 uuesti, ära muuda lifecycle truth'i, ära lõhu OFF/ON flag käitumist, eelista minimaalseid kõrge väärtusega muudatusi ja lõpeta iga faas tõendiga.
