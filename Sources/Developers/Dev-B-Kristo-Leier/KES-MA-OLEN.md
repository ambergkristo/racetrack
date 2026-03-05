# Dev B - pohiroll projektis

Dev B vastutab staff UI eest.

## Pohiroll

Dev B omab staff kasutajavoogu:
- /front-desk
- /race-control
- /lap-line-tracker

See roll tagab, et staff saab tootada turvaliselt, kiiresti ja arusaadavalt.

## Vastutusala

1. Staff route UX
- key gate modal enne socket connecti
- selged veaseisud ja disabled-state'id
- suured touch-targetid operatiivseks kasutuseks

2. Operatiivsed staff vaated
- front-desk sessioonide/s6itjate vaated
- race-control juhtnupud
- lap tracker sisendivaade

3. Turbevoog kliendis
- yhendus ainult peale edukat key verify't
- vale key korral selge veateade
- backendi 500ms viivituskaitsega kooskoos

4. Upgrade UI staff-poolel
- manual car assignment panel front-deskis
- ainult feature flag all

## Milestone vastutus

### M0
- staff route skeletonid
- key gate UX
- shared shell kasutus staff routeidel

### M1
- staff routeid reaalse state'iga
- race control ja lap tracker tootavad E2E flow's

### M2
- UX polish staff vaadetes
- reconnect, disabled reasons, veaseisud

### M3
- manual assignment UI (flagitud)
- OFF/ON regressiooni kontroll staff UX-is

## Yhe lausega Dev B roll

"Sa oled staff operatiivse kasutuskogemuse omanik."
