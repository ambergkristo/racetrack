# Simulation Assignment Car Behavior Alignment

## Assignment rules implemented

1. Cars are treated as the tracked race entities during simulation:
   - simulation state now carries each car number alongside the moving marker
   - lap-line crossings update the session entry that owns that assigned car

2. Cars start from the pit lane:
   - simulation launches every car on the pit lane first
   - cars no longer appear as if they already started a timed lap when the race starts

3. Lap 1 starts only after the first lap-line crossing:
   - simulated cars begin with `lapIndex = 0`
   - the first crossing moves them onto lap 1
   - that first crossing does not create a best lap yet

4. Each lap-line crossing increments laps:
   - every simulated crossing still calls the authoritative lap-crossing flow
   - best lap updates only when a newly completed timed lap is faster

5. Cars return to pit lane when the race finishes:
   - after checkered, cars visibly continue through finish handling and then route into pit lane
   - they do not disappear at checkered

6. Cars may still cross the lap line during Finish mode:
   - the first target car triggers `FINISHED`
   - remaining cars keep moving in `CHECKERED` mode until they reach the lap line and receive finish places

7. Once the mode becomes Finished, it does not revert:
   - simulation phase changes stop at checkered/pit-return flow
   - scenario timing no longer reverts the post-finish race truth back to safe/hazard modes

8. Session ends only after pit return:
   - auto-promotion to the next queued session happens only after every simulated car finishes pit return

9. Modes affect car behavior:
   - `SAFE` keeps normal pace
   - `HAZARD_SLOW` reduces simulated movement speed
   - `HAZARD_STOP` halts movement
   - `FINISHED` moves the race into checkered crossings and pit return

10. Up to 8 cars remain supported:
   - simulation snapshots, rendering, and tests still cover 8-car sessions

## What changed in lap logic

- simulation cars now launch from pit lane before reaching the track
- the first line crossing starts lap 1 instead of pretending the race-start button already did
- timed lap durations apply only after that first crossing
- finish order is now assigned from actual finish-mode crossings instead of invisible queue draining

## What changed in pit return logic

- pit lane is now part of the behavior at both ends of the run:
  - cars launch from pit lane at the start
  - cars return through pit lane after checkered
- pit return does not begin until finish-mode crossings are done

## What changed in session progression

- the active session stays authoritative through finish and pit return
- only after all cars are back in pit/garage does the simulation finalize and promote the next queued session to `STAGING`

## Validation results

- `npm run lint` passed
- `npm test` passed
- `npm run build` passed
- `npm run test:m3-matrix` passed
