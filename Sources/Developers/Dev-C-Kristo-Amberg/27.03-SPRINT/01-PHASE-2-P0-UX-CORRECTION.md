# Phase 2 P0 UX Correction
## Status
ACTIVE
## Goal
Muuta public route'id kasutatavaks ja kohe arusaadavaks, et publik näeks ühe pilguga praegust olukorda ilma dashboard-demo tunnetuseta.
## Scope for This Dev
- `/leader-board` ühe-ekraani loogika.
- `/next-race` muuta päriselt informatiivseks.
- `/race-countdown` teha kaugelt loetavaks.
- `/race-flags` teha ultra-minimaalseks fullscreen state board'iks.
## Not In Scope
- Staff route usability.
- Backend truth muutmine ilma Dev A proof'ita.
- Uus public feature scope väljaspool olemasolevaid route'e.
- Demo script.
## Dependencies
- Võib alustada kohe paralleelselt Dev A ja Dev B-ga.
- Kui public route jaoks on truth väli puudu, sõltud Dev A-st.
- Dev D alustab pärast A/B/C esimese usable passi kättesaadavust.
## Start Condition
- Võid alustada kohe.
- Kui public usability jääb truth puuduse taha, peab Dev A andma täpse välja proof'i enne, kui UI lahendus lukustatakse.
## Task List
- Kaardista iga public route peamine küsimus: mida kasutaja siit teada peab saama.
- Tee `/leader-board` ühe pilguga loetavaks.
- Tee `/next-race` nii, et see näitab päriselt järgmise sessiooni jaoks kasulikku infot.
- Tee `/race-countdown` kaugelt loetavaks ilma kõrvalmürata.
- Tee `/race-flags` võimalikult minimaalseks fullscreen board'iks.
- Anna Dev D-le märge, millal esimene usable public pass on valmis.
## Acceptance Checks
- Public route'il on kohe selge, mida ekraan ütleb.
- Primaarse info jaoks ei ole vaja 1080p peal vertikaalselt scrollida.
- `/race-flags` ei mõju enam dashboard-demo vaates.
- `/next-race` täidab infotahvli rolli, mitte placeholderi rolli.
## Evidence Required
- Screenshot vähemalt neljast public route'ist.
- Route verification märge iga public route'i kohta.
- PASS/FAIL märge, kas Dev D võib usability regressiooni alustada.
## Prompt Order Note
- Käivita see enne Dev D Phase 2 regressiooni.
- Kui state language läheb race-control truth'iga vastuollu, peata töö ja kooskõlasta Dev A/Dev B-ga.
- No scope drift: ära ava M3 uuesti, ära muuda lifecycle truth'i, ära lõhu OFF/ON flag käitumist, eelista minimaalseid kõrge väärtusega muudatusi ja lõpeta faas tõendiga.
