# Phase 5 Public Display Polish
## Status
ACTIVE
## Goal
Katta Dev C public polish töö fullscreen smoke'i ja readability proof'iga pärast esimest kasutatavat public-display passi.
## Scope for This Dev
- Fullscreen route smoke testid.
- 1080p readability pass.
- Tõestus, et public route'id on loetavad ja funktsionaalsed.
## Not In Scope
- UI disain.
- Staff route töö.
- Backend truth'i defineerimine.
- Demo lukustamine väljaspool smoke'i ja tõendeid.
## Dependencies
- Sõltub Dev C esimesest kasutatavast public-display passist.
- Dev B toetab semantika kooskõla kontrolli, kui see osutub vajalikuks.
## Start Condition
- Ei saa alustada kohe.
- Enne alustamist on vaja:
  - Dev C screenshot'e
  - route verification'it
  - commit'i või merge'i viidet
## Task List
- Käivita fullscreen smoke route'idel `/leader-board`, `/next-race`, `/race-countdown` ja `/race-flags`.
- Tee 1080p readability pass.
- Kinnita, et põhiinfo on nähtav 2-3 sekundiga.
- Märgi ära route'id, mis vajavad veel bounded polish'i.
## Acceptance Checks
- Fullscreen route'id ei lagune.
- 1080p peal on põhiinfo nähtav.
- Public route'id ei jäta enam dashboard-demo muljet.
- Dev C saab täpse ja piiratud tagasiside.
## Evidence Required
- Screenshot.
- Route verification.
- PASS/FAIL märge iga fullscreen route'i kohta.
## Prompt Order Note
- Alusta alles pärast Dev C esimest kasutatavat public-display passi.
- Tagasiside peab olema tõendipõhine, mitte maitsepõhine.
- No scope drift: ära ava M3 uuesti, ära muuda lifecycle truth'i, ära lõhu OFF/ON flag käitumist, eelista minimaalseid kõrge väärtusega muudatusi ja lõpeta faas tõendiga.
