# Phase 6 Demo Readiness
## Status
ACTIVE
## Goal
Tagada, et demo ajal nähtav backend truth on üheselt kontrollitav ja vajadusel kiiresti selgitatav.
## Scope for This Dev
- Toeta demo scripti backend truth punktidega.
- Kinnita, et näidatav state mapping on demoks selge.
- Ole valmis väikesteks truth-selgitusteks või viimasteks minimaalseteks parandusteks, kui Dev D või Dev C toob tõendi.
## Not In Scope
- Demo juhtimine Dev C või Dev B eest.
- Release checklist omamine Dev D asemel.
- Uute funktsioonide lisamine demo nimel.
- Visuaalne ümberdisain.
## Dependencies
- Vajab Phase 2–5 põhilise töö tõendit.
- Töötab koos Dev B, Dev C ja Dev D-ga.
## Start Condition
- Alusta pärast seda, kui Phase 2–5 on vähemalt esmase PASS/FAIL tõendiga kaetud.
- Kui vajad correction'it, peab enne olema olemas:
  - Dev D või Dev C poolt konkreetne demo risk
  - testitulemus, screenshot või route verification
## Task List
- Vaata üle demo ajal näidatavad state truth punktid.
- Koosta lühike backend truth kontrollnimekiri Dev D release checklist'i sisendiks.
- Kinnita, et `CHECKERED`, `LOCKED`, queue ja manual assignment on demoks arusaadavad.
- Osale vähemalt kahes kuivjooksus backend truth vaatlejana.
## Acceptance Checks
- Demo ajal ei teki state truth küsimust, mida keegi ei oska kohe vastata.
- Dev D saab release checklist'i jaoks konkreetse backend truth sisendi.
- Demo fallback ei riku lifecycle truth'i.
## Evidence Required
- Kuivjooksu PASS/FAIL märge.
- Demo truth kontrollnimekiri või selle viide.
- Route verification või testiviide kriitiliste state'ide kohta.
## Prompt Order Note
- Käivita pärast Phase 2–5 põhifailide läbimist.
- Tee see koos Dev D ja Dev C-ga, mitte eraldi vaakumis.
- No scope drift: ära ava M3 uuesti, ära muuda lifecycle truth'i, ära lõhu OFF/ON flag käitumist, eelista minimaalseid kõrge väärtusega muudatusi ja lõpeta faas tõendiga.
