# Phase 2 P0 UX Correction
## Status
ACTIVE
## Goal
Katta Phase 2 esimene kasutatavuse sprint truth-regressioonidega pärast seda, kui Dev A, Dev B ja Dev C on oma esimesed kasutatavad muudatused päriselt kättesaadavaks teinud.
## Scope for This Dev
- Staff ja public route'ide E2E flow kontroll.
- Snapshot parity testid.
- Fullscreen smoke testid.
- OFF/ON matrix peab jääma roheliseks.
## Not In Scope
- UI redesign.
- Uued feature'id.
- Backend truth'i defineerimine.
- Copywriting või layout'i ehitamine.
## Dependencies
- Sõltub Dev A, Dev B ja Dev C esimesest kasutatavast push'ist või merge'ist.
## Start Condition
- Ei saa alustada kohe.
- Enne alustamist on vaja:
  - screenshot'i või route verification'it mõjutatud route'idest
  - commit'i või merge'i viidet
  - lühikest märkust selle kohta, mida täpselt testida tuleb
## Task List
- Kinnita, millised route'id muutusid ja milline on uus usability pass.
- Käivita staff ja public route'ide truth E2E kontroll.
- Kontrolli snapshot parity't staff/public vahel.
- Tee fullscreen smoke fullscreen-sõbralikele public route'idele.
- Kinnita, et OFF/ON matrix püsib roheline.
## Acceptance Checks
- Kõik mõjutatud route'id laevad ja näitavad tõest infot.
- Snapshot parity ei triivi.
- Fullscreen režiim ei lõhu public vaateid.
- Feature-flag matrix jääb roheliseks.
## Evidence Required
- Testitulemus.
- Screenshot.
- Route verification.
- PASS/FAIL märge põhipaari või põhivoo kohta.
## Prompt Order Note
- Alusta alles pärast Dev A, Dev B ja Dev C kasutatava passi tõendit.
- Ära testi pushimata või merge'imata tööd.
- No scope drift: ära ava M3 uuesti, ära muuda lifecycle truth'i, ära lõhu OFF/ON flag käitumist, eelista minimaalseid kõrge väärtusega muudatusi ja lõpeta faas tõendiga.
