# Phase 3 Front Desk Workflow
## Status
NOT ACTIVE FOR THIS DEV
## Goal
Hoida Dev C selles faasis mitteaktiivsena, välja arvatud juhul, kui front-desk workflow muudatus vajab väikest public või shared wording compatibility note'i.
## Scope for This Dev
- Ainult vajaduspõhine compatibility note, kui front-desk või shared wording mõjutab public route'i pealkirju või state language'it.
## Not In Scope
- Front-desk workflow ehitamine.
- Queue loogika määramine.
- Racer management UX.
- Manual assignment workflow juhtimine.
## Dependencies
- Sõltub Dev A ja Dev B tööst.
- Dev C ei alusta enne, kui A/B on toonud konkreetse compatibility vajaduse.
## Start Condition
- Ei alga kohe.
- Enne alustamist peavad Dev A või Dev B lõpetama esmase workflow passi ja andma järgmise proof'i:
  - milline shared wording või state label vajab kooskõla
  - screenshot või route verification, mis näitab konflikti
## Task List
- Oota explicit compatibility request'i.
- Kui request tuleb, kontrolli, kas probleem puudutab päriselt public/shared language'i.
- Anna lühike wording note, mitte uus workflow disain.
## Acceptance Checks
- Dev C ei võta üle Dev B ega Dev A scope'i.
- Võimalik compatibility note on täpne ja piiratud.
- Public wording ei lähe front-desk truth'iga lahku.
## Evidence Required
- NOT ACTIVE märge või explicit compatibility proof.
- Kui aktiveerub, screenshot või route verification koos PASS/FAIL märkega.
## Prompt Order Note
- Vaikimisi ära käivita seda prompti.
- Käivita ainult siis, kui Dev A või Dev B toob tõendatud compatibility vajaduse.
- No scope drift: ära ava M3 uuesti, ära muuda lifecycle truth'i, ära lõhu OFF/ON flag käitumist, eelista minimaalseid kõrge väärtusega muudatusi ja lõpeta faas tõendiga.
