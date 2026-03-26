# 00 Start Order

## Staatus
ACTIVE

## Eesmärk
Määrata Dev D ametlik post-M3 start-order nii, et regression, gate, smoke ja fallback kontrollid jookseksid päris integratsiooni peal, mitte vaakumis.

## Millal alustada
- Phase 2: ära alusta kohe; alusta alles siis, kui Dev A, Dev B ja Dev C esimene kasutatav pass on olemas.
- Phase 3: alusta alles siis, kui Dev A ja Dev B workflow muudatused on olemas.
- Phase 4: alusta alles siis, kui Dev A, Dev B ja Dev C päris clarity muudatused on olemas.
- Phase 5: alusta alles siis, kui Dev C esimene kasutatav public pass on olemas.
- Phase 6: tööta koos kõigiga värske `main` pealt pärast eelmiste faaside PASS merge'i.

## Branch naming
- Phase 2: `feat/phase-2-devD-truth-regression`
- Phase 3: `feat/phase-3-devD-frontdesk-regression`
- Phase 4: `feat/phase-4-devD-race-control-regression`
- Phase 5: `feat/phase-5-devD-display-regression`
- Phase 6: `feat/phase-6-devD-release-checklist-fallback`

## Integration branch rule
- Phase 2 gate käib branchil `integration/phase-2-ux-correction`.
- Phase 3 gate käib branchil `integration/phase-3-front-desk-workflow`.
- Phase 4 gate käib branchil `integration/phase-4-race-control-clarity`.
- Phase 5 gate käib branchil `integration/phase-5-public-display-polish`.
- Phase 6 final gate käib branchil `integration/phase-6-demo-readiness`.
- Dev D ei tee merge'i `main`-i üksikust regressioonibranchist.

## Mida teha
- Loe enne tööd läbi enda Phase 2-6 failid järjekorras.
- Alusta regressiooni alles siis, kui vastav faas on reaalselt testitav.
- Seo iga regression jooks konkreetse integration branchi sisuga.
- Hoia PASS/FAIL otsus, smoke, fallback ja checklist tõendid koos.
- Phase 6 ajal koonda kogu sprinti lõplik readiness pakett.

## Tõend enne merge'i `main`-i
- Kõik aktiivsed dev branchid peavad olema jõudnud vastava faasi integration branchi.
- Nõutud gate või regression peab olema integration branchil käivitatud.
- Integration branch peab olema sõnaselgelt PASS.
- Tõend peab sisaldama vähemalt testitulemust, screenshot'i, route verification'it või muud faasile sobivat gate proof'i.

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
