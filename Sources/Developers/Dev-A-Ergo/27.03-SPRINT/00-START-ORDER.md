# 00 Start Order

## Staatus
ACTIVE

## Eesmärk
Määrata Dev A ametlik post-M3 start-order nii, et backend truth toetaks UX-i, workflow'd ja demo valmisolekut ilma lukustatud M3 käitumist murdmata.

## Millal alustada
- Phase 2: alusta kohe.
- Phase 3: alusta kohe paralleelselt Dev B-ga.
- Phase 4: alusta kohe paralleelselt Dev B-ga.
- Phase 5: oota, kuni Dev B või Dev C tõendab explicit backend support vajaduse.
- Phase 6: alusta värske `main` pealt pärast eelmiste faaside PASS merge'i.

## Branch naming
- Phase 2: `feat/phase-2-devA-truth-ui-support`
- Phase 3: `feat/phase-3-devA-frontdesk-backend-truth`
- Phase 4: `feat/phase-4-devA-state-clarity-support`
- Phase 6: `feat/phase-6-devA-backend-demo-support`
- Phase 5 kasutab Dev A branchi ainult siis, kui backend support on sõnaselgelt aktiveeritud ja see töö tuleb teha värskeima `main` pealt.

## Integration branch rule
- Phase 2 töö peab minema branchi `integration/phase-2-ux-correction`.
- Phase 3 töö peab minema branchi `integration/phase-3-front-desk-workflow`.
- Phase 4 töö peab minema branchi `integration/phase-4-race-control-clarity`.
- Phase 5 võimalik backend support peab minema branchi `integration/phase-5-public-display-polish`.
- Phase 6 töö peab minema branchi `integration/phase-6-demo-readiness`.
- Ükski Dev A branch ei lähe otse `main`-i.

## Mida teha
- Loe enne tööd läbi enda Phase 2-6 failid järjekorras.
- Phase 2 jaoks lukusta snapshot, derived field ja state mapping truth.
- Phase 3 jaoks lukusta queue/current/next ordering truth.
- Phase 4 jaoks lukusta FINISHED vs LOCKED eristus backend truth'i tasemel.
- Phase 5 puhul tee ainult selgelt küsitud backend support.
- Phase 6 ajal anna demo jaoks viimased backend truth kontrollpunktid.

## Tõend enne merge'i `main`-i
- Dev A muudatus peab olema maandunud vastava faasi integration branchi.
- Vastava faasi gate või regression peab olema integration branchil käivitatud.
- Integration branch peab olema sõnaselgelt PASS.
- Tõend peab sisaldama vähemalt route verification'it, testi või muud faasile sobivat truth/proof märget.

## Integration Reminder
- Arendaja branch ei lähe nende post-M3 faaside jooksul KUNAGI otse `main`-i.
- Enne merge'i `main`-i peab Codex kontrollima:
1. kas kõik selle faasi aktiivsed dev branchid on jõudnud faasi integration branchi
2. kas nõutud faasi gate või regression on käivitatud
3. kas integration branch on PASS
- Kui mõni tingimus ei ole täidetud, peab Codex peatuma ja ütlema:
`Phase integration is required before merge to main.`

## No scope drift
- ära ava M3 uuesti
- ära disaini süsteemi nullist ümber
- ära muuda lifecycle truth'i
- ära lõhu OFF/ON feature-flag käitumist
- eelista minimaalseid, kõrge väärtusega muudatusi
- iga faas peab lõppema tõendi ja PASS/FAIL tulemusega
- `main` jääb faaside vahel ainsaks tõeallikaks
