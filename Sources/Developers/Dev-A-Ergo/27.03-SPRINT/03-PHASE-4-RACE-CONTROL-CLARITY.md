# Phase 4 Race Control Clarity
## Status
ACTIVE
## Goal
Tagada, et backend truth eristab selgelt `RUNNING`, `FINISHED` ja `LOCKED` tähendused ning ükski UI ei pea neid oletama.
## Scope for This Dev
- Vajadusel explicit state label või derived field.
- FINISHED ja LOCKED semantika backend truth'i kontroll.
- Kinnita, et `Finish` ja `End+Lock` on andmemudelis loogiliselt erinevad.
## Not In Scope
- Nuppude layout.
- Public view copywriting.
- Uued safety mode'id.
- Uus lifecycle diagramm väljaspool olemasolevaid state'e.
## Dependencies
- Võib alustada kohe paralleelselt Dev B-ga.
- Dev C saab peegeldava public sõnavara teha pärast või B lõppfaasis.
- Dev D saab regressioonid käivitada pärast A/B/C muudatuste kättesaadavust.
## Start Condition
- Võid alustada kohe.
- Enne lõppkinnitust peab olema Dev B poolt proof, et race-control UI kasutab just neid state tähendusi, mida backend kirjeldab.
## Task List
- Vaata üle `FINISHED` ja `LOCKED` truth mapping.
- Kinnita, et post-finish lap on lubatud, aga post-lock lap on blokeeritud.
- Kinnita, et state label või derived field ei lase UI-l segi ajada `CHECKERED` ja `LOCKED`.
- Anna Dev C-le sõnastus, mida public views peavad peegeldama.
- Anna Dev D-le regressiooni kontrollpunktid Finish -> post-finish lap -> lock -> blocked flow jaoks.
## Acceptance Checks
- `FINISHED` ja `LOCKED` ei ole backend truth'is segiaetavad.
- `flag` ja `state` kombinatsioon on üheselt tõlgendatav.
- Public mirror saab sama state language'i kasutada ilma erandiloogikata.
- Dev D saab regressiooni kirjutada ühe tähendusega assertion'itele.
## Evidence Required
- Route või API proof `FINISHED` vs `LOCKED` kohta.
- Testitulemus või olemasoleva testi viide post-finish ja post-lock käitumise kohta.
- PASS/FAIL märge, kas state truth on race-control clarity jaoks valmis.
## Prompt Order Note
- Käivita paralleelselt Dev B Phase 4 tööga.
- Teavita Dev C-d kohe, kui state language on lukus.
- No scope drift: ära ava M3 uuesti, ära muuda lifecycle truth'i, ära lõhu OFF/ON flag käitumist, eelista minimaalseid kõrge väärtusega muudatusi ja lõpeta faas tõendiga.
