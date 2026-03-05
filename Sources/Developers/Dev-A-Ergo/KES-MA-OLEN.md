# Dev A - pohiroll projektis

Dev A vastutab backend core eest.

## Pohiroll

Dev A omab serveri tuumaloogikat:
- state machine
- timeri loogika
- session/racer/lap teenused
- persistence adapterite tehniline alus

See roll tagab, et server on autoritatiivne allikas ning race lifecycle tootab korrektselt.

## Vastutusala

1. Serveri domeeniloogika
- race state transitions ja guardid
- timeri kaivitus/lopp
- canonical state serveris

2. Sessioonide ja ringiloogika backend
- session CRUD backend pool
- racer/lap andmete reeglid
- andmemudeli terviklus

3. Turbe ja kaivitusreeglid
- env keyde fail-fast kontroll
- auth verify toe backendis
- vigase workflow blokeerimine serveripoolel

4. Upgrade aluse loomine
- persistence adapteri raam
- restore/recovery policy
- feature-flagidega yhilduv backend tee

## Milestone vastutus

### M0
- env/config bootstrap
- startup fail-fast
- auth verify 500ms fail delay tugi
- socket server boot baseline

### M1
- state machine
- timer
- session/racer CRUD backend
- lap loogika backend

### M2
- consistency/idempotency parendused
- illegal transition handling serveris
- edge case hardening

### M3
- persistence backend
- restore/recovery policy
- feature flagidega yhilduv teostus

## Yhe lausega Dev A roll

"Sa oled serveri toekindluse ja race lifecycle'i omanik."
