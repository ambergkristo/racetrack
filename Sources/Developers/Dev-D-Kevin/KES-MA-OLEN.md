# Dev D - pohiroll projektis

Dev D vastutab kolme pohivaldkonna eest:

1. Socket.IO kommunikatsioonilepingu (contract) defineerimine
2. Automaatsete testide ja kvaliteedigate'ide loomine
3. Observability ehk systeemi jalgitavuse ja diagnostika loomine

See roll tagab, et kogu systeem tootab stabiilselt, kontrollitult ja moodetavalt.

Rollijaotus on projektis fikseeritud: Dev D tegeleb socket event contracti, validatsiooni, integration testide, observability ja CI kvaliteedigate'idega.

## Milestone-plan

## 1. Socket Contract (koige kriitilisem osa)

Dev D defineerib kogu realtime API, mille kaudu frontend ja backend suhtlevad.

Kuna systeem kasutab Socket.IO ja polling ei ole lubatud, on see contract systeemi selgroog.

### Mida Dev D teeb

### 1.1 Eventide nimekiri

Ta defineerib koik realtime syndmused.

Client -> Server naited:
- `client:hello`
- `lap:crossing`
- `race:start`
- `race:mode:set`
- `race:end_lock`

Server -> Client naited:
- `server:hello`
- `race:snapshot`
- `race:tick`
- `leaderboard:update`
- `server:error`

### 1.2 Payload schema

Iga event peab olema range tyypitud ja valideeritud.

Naiteks `lap:crossing`:

```json
{
  "carNumber": 12,
  "timestamp": 1730000000000
}
```

### 1.3 Runtime validation

Dev D valib validatsiooniraamistiku (nt `zod` voi `io-ts`) ja tagab:
- invalid event -> reject
- invalid payload -> error

### 1.4 Version-safe contract

Contract peab olema forward compatible, et:
- UI saab areneda
- backend saab muutuda
- breaking muudatusi valditakse

Naiteks fail:
- `src/socket/contract.ts`

## 2. Testid (Quality Assurance)

Dev D ehitab projekti automaatse kvaliteedikihi.

Ta vastutab testide eest, mis kontrollivad, et systeem ei laheks katki:
- unit testid
- integration testid
- socket flow testid

### 2.1 Integration test

Naide:
- start server
- connect socket
- expect `server:hello`
- disconnect

### 2.2 Race lifecycle testid

Naiteks:
- `race:start`
- `lap:crossing`
- `race:finish`
- `race:end_lock`

Ja kontrollib:
- state transitions
- event broadcast

### 2.3 Regression protection

Testid tagavad, et:
- state machine ei murdu
- socket contract ei muutu kogemata
- lap logic tootab alati

## 3. CI kvaliteedigate'id

Dev D loob CI pipeline'i, mis kontrollib iga PR-i.

CI peab tegema automaatselt:
- lint
- test
- build

Kui midagi kukub labi:
- PR ei merge

## 4. Observability (systeemi jalgitavus)

Dev D loob mehhanismid, et naha:
- kas systeem tootab
- mis laks katki
- kus latency tekib

### 4.1 Logid

Naiteks:
- `race:start`
- `race:mode:set`
- `lap:crossing`
- `session:end`

### 4.2 Error logging

Naiteks:
- invalid payload
- auth failure
- state transition blocked

### 4.3 Performance metrics

Naiteks:
- flag update latency
- lap event processing time
- socket reconnect rate

Need on seotud ka projekti moodikutega (North Star ja input metrics).

## Masterplan

## 5. Realtime kvaliteedireeglid

Dev D peab tagama jargmised systeemi reeglid:
- polling ei ole lubatud
- koik state update'id tulevad socket eventidega
- koik inbound eventid valideeritakse
- server broadcastib canonical state'i

## 6. Dev D vastutus milestone'ides

### M0
- socket schema baseline
- contract failid
- smoke test
- CI pipeline

### M1
- event validation
- integration testid
- race event flow

### M2
- reconnect testid
- edge case testid
- idempotency

### M3
- feature flag test matrix
- persistence testid

## 7. Yhe lausega Dev D roll

"Sa oled meie realtime API arhitekt ja kvaliteedivalvur."

Ta vastutab selle eest, et:
- koik socket eventid on defineeritud
- koik sonumid on valideeritud
- systeem on testitud
- CI ei lase katkist koodi `main` branchi
