# Phase 5 Public Display Polish
## Status
ACTIVE
## Goal
Teha public route'idest päris infotahvlid, millest külaline või sõitja saab vajaliku info 2–3 sekundiga.
## Scope for This Dev
- Leaderboard:
  - selge ranking
  - best lap
  - current lap
  - countdown
  - flag state
- Next race:
  - järgmise sessiooni racerid
  - autonumbrid
  - post-race “go to pit” loogika
- Countdown:
  - suur timer
  - session name
  - basic roster või status
- Flags:
  - color või checkered pattern only
  - fullscreen-friendly
  - minimaalne lisainfo
## Not In Scope
- Staff route refaktor.
- Backend truth ümberdisain.
- Uute public route'ide lisamine.
- Demo readiness checklist.
## Dependencies
- Dev C juhib.
- Dev B toetab semantika kooskõla kontrolliga.
- Dev D alustab pärast sinu esimest usable public-display passi.
- Dev A ainult explicit backend support korral.
## Start Condition
- Võid alustada pärast Phase 4 state mirror passi.
- Enne Dev D smoke'i peab sul olema:
  - vähemalt üks usable pass kõigil neljal public route'il
  - screenshotid või route verification
## Task List
- Tee leaderboard kohe loetavaks ja järjestus domineerivaks.
- Tee next-race vaade päriselt informatiivseks järgmise sessiooni jaoks.
- Tee countdown kaugelt loetavaks suure timeri ja minimaalse kõrvalinfoga.
- Tee flags vaade võimalikult lähedaseks “fullscreen color/flag only” kasutusele.
- Anna Dev B-le üle semantika kontrollpunktid.
- Anna Dev D-le märk, millal esimene usable public pass on valmis.
## Acceptance Checks
- Public route'id ei tundu enam dashboard demo-na.
- `/race-flags` on peaaegu puhas fullscreen state board.
- `/next-race` täidab user-story eesmärki.
- Guest või racer saab põhiseisundi 2–3 sekundiga kätte.
## Evidence Required
- Screenshot kõigist neljast public route'ist.
- Route verification loetelu.
- PASS/FAIL märge, kas Dev D võib fullscreen/readability smoke'i alustada.
## Prompt Order Note
- See on Dev C juhtiv faas.
- Dev D alustab alles pärast sinu esimest usable public-display passi.
- No scope drift: ära ava M3 uuesti, ära muuda lifecycle truth'i, ära lõhu OFF/ON flag käitumist, eelista minimaalseid kõrge väärtusega muudatusi ja lõpeta faas tõendiga.
