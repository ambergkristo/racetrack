# 00 Start Order

## Staatus
ACTIVE

## Eesmärk
Määrata Dev C ametlik post-M3 start-order public usability, state language mirror'i, public display polish'i ja demo koherentsi jaoks.

## Millal alustada
- Phase 2: alusta kohe paralleelselt Dev A ja Dev B-ga.
- Phase 3: ära alusta vaikimisi; liigu sisse ainult siis, kui on vaja compatibility input'i.
- Phase 4: alusta pärast või Dev B töö lõpuosas, kui race-control truth ja sõnavara on olemas.
- Phase 5: alusta esimesena ja juhi faasi.
- Phase 6: alusta värske `main` pealt pärast eelmiste faaside PASS merge'i.

## Branch naming
- Phase 2: `feat/phase-2-devC-public-usability`
- Phase 4: `feat/phase-4-devC-public-state-language`
- Phase 5: `feat/phase-5-devC-public-display-polish`
- Phase 6: `feat/phase-6-devC-public-demo-readiness`
- Phase 3-s eraldi branchi ei kasutata, kui puudub selge compatibility vajadus.

## Integration branch rule
- Phase 2 töö peab minema branchi `integration/phase-2-ux-correction`.
- Phase 4 töö peab minema branchi `integration/phase-4-race-control-clarity`.
- Phase 5 töö peab minema branchi `integration/phase-5-public-display-polish`.
- Phase 6 töö peab minema branchi `integration/phase-6-demo-readiness`.
- Kui Phase 3 compatibility input siiski tekib, peab see minema branchi `integration/phase-3-front-desk-workflow`.
- Ükski Dev C branch ei lähe otse `main`-i.

## Mida teha
- Loe enne tööd läbi enda Phase 2-6 failid järjekorras.
- Phase 2 jaoks tee public route usability audit ja parandused.
- Phase 3 hoia reservis ainult compatibility märkuste jaoks.
- Phase 4 jaoks peegelda public route'idele sama state language, mis on race-control truth'is.
- Phase 5 ajal juhi public display polish tööd.
- Phase 6 ajal lukusta public demo coherence.

## Tõend enne merge'i `main`-i
- Dev C muudatus peab olema maandunud vastava faasi integration branchi.
- Vastava faasi gate või regression peab olema integration branchil käivitatud.
- Integration branch peab olema sõnaselgelt PASS.
- Tõend peab sisaldama vähemalt screenshot'i, route verification'it või muud faasile sobivat public proof'i.

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
