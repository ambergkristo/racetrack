# 00 Start Order

## Staatus
ACTIVE

## Eesmärk
Määrata Dev B ametlik post-M3 start-order staff usability, front-desk workflow, race-control clarity ja demo readiness tööks.

## Millal alustada
- Phase 2: alusta kohe paralleelselt Dev A ja Dev C-ga.
- Phase 3: alusta kohe paralleelselt Dev A-ga.
- Phase 4: alusta kohe paralleelselt Dev A-ga.
- Phase 5: alusta siis, kui Dev C esimene kasutatav public pass on olemas.
- Phase 6: alusta värske `main` pealt pärast eelmiste faaside PASS merge'i.

## Branch naming
- Phase 2: `feat/phase-2-devB-staff-usability`
- Phase 3: `feat/phase-3-devB-frontdesk-workflow`
- Phase 4: `feat/phase-4-devB-race-control-clarity`
- Phase 5: `feat/phase-5-devB-semantics-alignment`
- Phase 6: `feat/phase-6-devB-operator-demo-flow`

## Integration branch rule
- Phase 2 töö peab minema branchi `integration/phase-2-ux-correction`.
- Phase 3 töö peab minema branchi `integration/phase-3-front-desk-workflow`.
- Phase 4 töö peab minema branchi `integration/phase-4-race-control-clarity`.
- Phase 5 töö peab minema branchi `integration/phase-5-public-display-polish`.
- Phase 6 töö peab minema branchi `integration/phase-6-demo-readiness`.
- Ükski Dev B branch ei lähe otse `main`-i.

## Mida teha
- Loe enne tööd läbi enda Phase 2-6 failid järjekorras.
- Phase 2 jaoks tee staff usability parandused ja märgi route kaupa probleemid.
- Phase 3 jaoks oma front-desk workflow current/next/queued töökäik.
- Phase 4 jaoks oma race-control clarity ja operator path.
- Phase 5 ajal joonda staff/public semantika Dev C tööga.
- Phase 6 ajal lukusta operator demo flow.

## Tõend enne merge'i `main`-i
- Dev B muudatus peab olema maandunud vastava faasi integration branchi.
- Vastava faasi gate või regression peab olema integration branchil käivitatud.
- Integration branch peab olema sõnaselgelt PASS.
- Tõend peab sisaldama vähemalt route verification'it, screenshot'i või muud faasile sobivat usability/workflow proof'i.

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
