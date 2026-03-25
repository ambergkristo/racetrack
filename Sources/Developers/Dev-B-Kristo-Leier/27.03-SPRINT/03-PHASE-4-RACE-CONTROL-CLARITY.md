# Phase 4 Race Control Clarity
## Status
ACTIVE
## Goal
Muuta `/race-control` kasutatavaks nii, et safety officer ei pea kordagi oletama, mis state praegu on või mis nupp on lubatud.
## Scope for This Dev
- Start / Finish / End+Lock nupud visuaalselt ja loogiliselt primaarseks.
- Mode controls ainult lubatud olekus.
- Disabled-state põhjused lühikeseks ja selgeks.
- Finish = checkered flag peab olema väga selgelt nähtav.
## Not In Scope
- Public route mirror tekstide omamine.
- Lifecycle truth ümbertegemine.
- Uued control flow'd väljaspool olemasolevat race-control ulatust.
- Täielik visuaalne ümberdisain.
## Dependencies
- Võib alustada kohe paralleelselt Dev A-ga.
- Dev C alustab peegeldust pärast või sinu töö lõppfaasis.
- Dev D alustab pärast A/B/C muudatuste kättesaadavust.
## Start Condition
- Võid alustada kohe.
- Enne lõpliku state language'i kinnitamist peab Dev A andma proof'i, et FINISHED ja LOCKED truth on ühesed.
## Task List
- Tee Start, Finish ja End+Lock visual hierarchy nii, et primaarne tegevus paistab kohe välja.
- Näita mode controls ainult siis, kui nende kasutamine on päriselt lubatud.
- Lühenda kõik disabled-state põhjused üheks kiirelt loetavaks lauseks.
- Tõsta checkered tähendus Finish järel visuaalselt esile.
- Anna Dev C-le täpne state language, mida public route'id peavad peegeldama.
- Anna Dev D-le kontrollitav operator flow järjekord: Start -> Finish -> post-finish lap -> Lock.
## Acceptance Checks
- Race control on kasutatav ilma eelneva selgituseta.
- Finish ja Lock ei ole visuaalselt ega loogiliselt segi aetavad.
- Mode controls ei teki nähtavale vales state'is.
- Disabled põhjused on lühikesed, mitte seletuskirjad.
## Evidence Required
- Screenshot race-control vaatest vähemalt kahes state'is.
- Route verification märge Start/Finish/Lock loogika kohta.
- PASS/FAIL märge, kas public mirror võib sama sõnavara võtta.
## Prompt Order Note
- Käivita paralleelselt Dev A Phase 4 tööga.
- Dev C Phase 4 peab kasutama sinu ja Dev A poolt lukustatud state language'i.
- No scope drift: ära ava M3 uuesti, ära muuda lifecycle truth'i, ära lõhu OFF/ON flag käitumist, eelista minimaalseid kõrge väärtusega muudatusi ja lõpeta faas tõendiga.
