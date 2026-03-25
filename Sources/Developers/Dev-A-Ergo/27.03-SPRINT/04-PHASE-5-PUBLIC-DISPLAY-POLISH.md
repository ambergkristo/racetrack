# Phase 5 Public Display Polish
## Status
NOT ACTIVE FOR THIS DEV
## Goal
Hoida Dev A selles faasis reserveerituna ainult explicit backend support jaoks, kui public display polish ei ole võimalik olemasoleva truth'iga valmis teha.
## Scope for This Dev
- Ainult vajaduspõhine backend support Dev C või Dev B jaoks.
- Ainult route-spetsiifiline derived field või truth correction, kui olemasolev `main` truth ei kata public user-story't.
## Not In Scope
- Public layout.
- Readability polish.
- Fullscreen UI töö.
- Uus infoarhitektuur public route'idele.
- Demo script.
## Dependencies
- Sõltub Dev C-st.
- Vajadusel sõltub ka Dev B semantika kontrollist.
## Start Condition
- Ei alga kohe.
- Enne alustamist peavad Dev C või Dev B lõpetama esmase public-display passi ja andma järgmise proof'i:
  - milline route on probleemne
  - mis täpne truth väli on puudu või mitmetimõistetav
  - screenshot või route verification, mis seda tõendab
## Task List
- Oota explicit backend support taotlust.
- Kui taotlus tuleb, valideeri, kas probleem on päriselt backend truth'is.
- Kui backend support on põhjendatud, kirjelda minimaalne vajalik väli või mapping.
- Anna Dev D-le assertion, mida public polish regressioonis kontrollida.
## Acceptance Checks
- Dev A ei tee selles faasis asjatut backend tööd.
- Iga võimalik sekkumine on põhjendatud konkreetse public route proof'iga.
- M3 runtime truth jääb puutumata.
## Evidence Required
- NOT ACTIVE märge või explicit support request.
- Kui aktiveerub, screenshot või route verification ja PASS/FAIL otsus.
## Prompt Order Note
- Vaikimisi ära käivita seda prompti.
- Käivita ainult siis, kui Dev C või Dev B tõendab backend truth'i puudujäägi.
- No scope drift: ära ava M3 uuesti, ära muuda lifecycle truth'i, ära lõhu OFF/ON flag käitumist, eelista minimaalseid kõrge väärtusega muudatusi ja lõpeta faas tõendiga.
