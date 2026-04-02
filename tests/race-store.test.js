const assert = require("node:assert/strict");
const { createRaceStore } = require("../src/domain/raceStore");
const { buildRaceStateTruth } = require("../src/domain/raceStateTruth");
const { test } = require("./helpers/testHarness");

test("race store ignores non-positive lap deltas without corrupting leaderboard timing", () => {
  const raceStore = createRaceStore({
    raceDurationSeconds: 60,
    now: () => 1_000,
  });

  const session = raceStore.createSession({ name: "Heat 1" });
  const racer = raceStore.addRacer(session.id, {
    name: "Amy",
  });

  raceStore.startRace();

  const firstCrossing = raceStore.recordLapCrossing({
    racerId: racer.id,
    timestampMs: 10_000,
  });
  assert.equal(firstCrossing.lapCount, 1);
  assert.equal(firstCrossing.currentLapTimeMs, null);
  assert.equal(firstCrossing.bestLapTimeMs, null);

  const duplicateTimestampCrossing = raceStore.recordLapCrossing({
    racerId: racer.id,
    timestampMs: 10_000,
  });
  assert.equal(duplicateTimestampCrossing.lapCount, 2);
  assert.equal(duplicateTimestampCrossing.currentLapTimeMs, null);
  assert.equal(duplicateTimestampCrossing.bestLapTimeMs, null);
  assert.equal(duplicateTimestampCrossing.lastCrossingTimestampMs, 10_000);

  const outOfOrderCrossing = raceStore.recordLapCrossing({
    racerId: racer.id,
    timestampMs: 9_500,
  });
  assert.equal(outOfOrderCrossing.lapCount, 3);
  assert.equal(outOfOrderCrossing.currentLapTimeMs, null);
  assert.equal(outOfOrderCrossing.bestLapTimeMs, null);
  assert.equal(outOfOrderCrossing.lastCrossingTimestampMs, 10_000);

  const validTimedCrossing = raceStore.recordLapCrossing({
    racerId: racer.id,
    timestampMs: 10_600,
  });
  assert.equal(validTimedCrossing.lapCount, 4);
  assert.equal(validTimedCrossing.currentLapTimeMs, 600);
  assert.equal(validTimedCrossing.bestLapTimeMs, 600);
  assert.equal(validTimedCrossing.lastCrossingTimestampMs, 10_600);

  const snapshot = raceStore.getSnapshot();
  assert.equal(snapshot.leaderboard[0].currentLapTimeMs, 600);
  assert.equal(snapshot.leaderboard[0].bestLapTimeMs, 600);
});

test("race store exposes checkered finish state and freezes the locked session snapshot", () => {
  const nowValues = [1_000, 2_000, 3_000, 4_000, 5_000];
  const raceStore = createRaceStore({
    raceDurationSeconds: 90,
    now: () => nowValues.shift() ?? 5_000,
  });

  const session = raceStore.createSession({ name: "Heat 2" });
  const racer = raceStore.addRacer(session.id, {
    name: "Ben",
  });

  raceStore.startRace();
  raceStore.recordLapCrossing({ racerId: racer.id, timestampMs: 10_000 });
  raceStore.finishRace({ reason: "manual" });

  const finishedSnapshot = raceStore.getSnapshot();
  assert.equal(finishedSnapshot.state, "FINISHED");
  assert.equal(finishedSnapshot.flag, "CHECKERED");
  assert.equal(finishedSnapshot.lapEntryAllowed, true);
  assert.equal(finishedSnapshot.activeSession?.id, session.id);
  assert.equal(finishedSnapshot.lockedSession, null);

  raceStore.lockRace();
  const lockedSnapshot = raceStore.getSnapshot();
  assert.equal(lockedSnapshot.state, "LOCKED");
  assert.equal(lockedSnapshot.flag, "LOCKED");
  assert.equal(lockedSnapshot.lapEntryAllowed, false);
  assert.equal(lockedSnapshot.activeSessionId, null);
  assert.equal(lockedSnapshot.activeSession, null);
  assert.equal(lockedSnapshot.lockedSession?.id, session.id);
  assert.equal(lockedSnapshot.leaderboard.length, 1);
  assert.equal(lockedSnapshot.leaderboard[0].racerId, racer.id);
  assert.equal(lockedSnapshot.leaderboard[0].lapCount, 1);
});

test("race store records first post-checkered crossing order and ignores repeat finish taps", () => {
  const raceStore = createRaceStore({
    raceDurationSeconds: 90,
    now: () => 1_000,
  });

  const session = raceStore.createSession({ name: "Heat 3" });
  const amy = raceStore.addRacer(session.id, { name: "Amy" });
  const ben = raceStore.addRacer(session.id, { name: "Ben" });

  raceStore.startRace();
  raceStore.recordLapCrossing({ racerId: amy.id, timestampMs: 10_000 });
  raceStore.recordLapCrossing({ racerId: ben.id, timestampMs: 10_200 });
  raceStore.finishRace({ reason: "manual" });

  const amyFinish = raceStore.recordLapCrossing({ racerId: amy.id, timestampMs: 20_000 });
  const benFinish = raceStore.recordLapCrossing({ racerId: ben.id, timestampMs: 20_600 });
  const amyRepeat = raceStore.recordLapCrossing({ racerId: amy.id, timestampMs: 21_200 });

  assert.equal(amyFinish.finishPlace, 1);
  assert.equal(benFinish.finishPlace, 2);
  assert.equal(amyRepeat.lapCount, 2);
  assert.equal(amyRepeat.finishPlace, 1);

  const finishedSnapshot = raceStore.getSnapshot();
  assert.equal(finishedSnapshot.finishOrderActive, true);
  assert.equal(finishedSnapshot.leaderboard[0].racerId, amy.id);
  assert.equal(finishedSnapshot.leaderboard[0].finishPlace, 1);
  assert.equal(finishedSnapshot.leaderboard[1].racerId, ben.id);
  assert.equal(finishedSnapshot.leaderboard[1].finishPlace, 2);
});

test("derived state truth keeps FINISHED distinct from LOCKED", () => {
  const raceStore = createRaceStore({
    raceDurationSeconds: 60,
    now: () => 1_000,
  });

  const session = raceStore.createSession({ name: "Heat 1" });
  const racer = raceStore.addRacer(session.id, {
    name: "Amy",
  });

  raceStore.startRace();
  raceStore.recordLapCrossing({ racerId: racer.id, timestampMs: 10_000 });
  raceStore.finishRace();

  const finishedTruth = buildRaceStateTruth(raceStore.getSnapshot());
  assert.equal(finishedTruth.stateLabel, "Finished");
  assert.equal(finishedTruth.flag, "CHECKERED");
  assert.equal(finishedTruth.lapEntryAllowed, true);
  assert.equal(finishedTruth.resultsFinalized, false);

  raceStore.lockRace();

  const lockedTruth = buildRaceStateTruth(raceStore.getSnapshot());
  assert.equal(lockedTruth.stateLabel, "Locked");
  assert.equal(lockedTruth.flag, "LOCKED");
  assert.equal(lockedTruth.lapEntryAllowed, false);
  assert.equal(lockedTruth.resultsFinalized, true);
});

test("race store exposes canonical current, next, and queued session truth", () => {
  const raceStore = createRaceStore({
    raceDurationSeconds: 60,
    now: () => 2_000,
  });

  const heat1 = raceStore.createSession({ name: "Heat 1" });
  const heat2 = raceStore.createSession({ name: "Heat 2" });
  const heat3 = raceStore.createSession({ name: "Heat 3" });

  let snapshot = raceStore.getSnapshot();
  assert.equal(snapshot.currentSessionId, heat1.id);
  assert.equal(snapshot.currentSession?.id, heat1.id);
  assert.equal(snapshot.nextSessionId, heat2.id);
  assert.deepEqual(snapshot.queuedSessionIds, [heat2.id, heat3.id]);

  raceStore.selectSession(heat3.id);
  snapshot = raceStore.getSnapshot();
  assert.equal(snapshot.currentSessionId, heat3.id);
  assert.equal(snapshot.nextSessionId, heat1.id);
  assert.deepEqual(snapshot.queuedSessionIds, [heat1.id, heat2.id]);

  raceStore.deleteSession(heat1.id);
  snapshot = raceStore.getSnapshot();
  assert.equal(snapshot.currentSessionId, heat3.id);
  assert.equal(snapshot.nextSessionId, heat2.id);
  assert.deepEqual(snapshot.queuedSessionIds, [heat2.id]);

  raceStore.startRace();
  raceStore.finishRace();
  raceStore.lockRace();

  snapshot = raceStore.getSnapshot();
  assert.equal(snapshot.currentSessionId, heat2.id);
  assert.equal(snapshot.currentSession?.id, heat2.id);
  assert.equal(snapshot.activeSessionId, heat2.id);
  assert.equal(snapshot.nextSessionId, null);
  assert.deepEqual(snapshot.queuedSessionIds, []);
});

test("race store auto-assigns cars from the authoritative 1-8 pool by default", () => {
  const raceStore = createRaceStore({
    raceDurationSeconds: 60,
    now: () => 2_000,
  });

  const session = raceStore.createSession({ name: "Heat Cars" });
  const racers = Array.from({ length: 8 }, (_unused, index) =>
    raceStore.addRacer(session.id, { name: `Racer ${index + 1}` })
  );

  assert.deepEqual(
    racers.map((racer) => racer.carNumber),
    ["1", "2", "3", "4", "5", "6", "7", "8"]
  );

  assert.throws(
    () => raceStore.addRacer(session.id, { name: "Overflow Racer" }),
    (error) => error.code === "SESSION_CAR_POOL_EXHAUSTED"
  );
});

test("race store keeps duplicate car prevention behind manual assignment mode", () => {
  const raceStore = createRaceStore({
    raceDurationSeconds: 60,
    now: () => 2_000,
    manualCarAssignmentEnabled: true,
  });

  const session = raceStore.createSession({ name: "Manual Heat Cars" });
  const amy = raceStore.addRacer(session.id, { name: "Amy", carNumber: "7" });
  assert.equal(amy.carNumber, "7");

  assert.throws(
    () => raceStore.addRacer(session.id, { name: "Ben", carNumber: "7" }),
    (error) => error.code === "DUPLICATE_CAR_NUMBER"
  );

  const ben = raceStore.addRacer(session.id, { name: "Ben", carNumber: "8" });
  assert.equal(ben.carNumber, "8");

  assert.throws(
    () => raceStore.updateRacer(session.id, ben.id, { carNumber: "7" }),
    (error) => error.code === "DUPLICATE_CAR_NUMBER"
  );
});

test("simulation starts racers together, auto-checkers after target laps, and records finish order", () => {
  let currentNow = 1_000;
  const raceStore = createRaceStore({
    raceDurationSeconds: 600,
    now: () => currentNow,
    simulationConfig: {
      baselineLapMsMin: 100,
      baselineLapMsMax: 100,
      jitterMsMin: 0,
      jitterMsMax: 0,
      minLapDurationMs: 1,
      drainIntervalMs: 10,
      targetLapCount: 3,
      maxDurationMs: 10_000,
    },
  });

  const session = raceStore.createSession({ name: "Sim Heat" });
  const amy = raceStore.addRacer(session.id, { name: "Amy" });
  const ben = raceStore.addRacer(session.id, { name: "Ben" });

  raceStore.startSimulation({
    startedAtMs: currentNow,
    seed: 42,
    maxDurationMs: 10_000,
    targetLapCount: 3,
  });

  let snapshot = raceStore.getSnapshot();
  assert.equal(snapshot.state, "RUNNING");
  assert.equal(snapshot.simulation.active, true);
  assert.deepEqual(
    snapshot.simulation.racers.map((racer) => racer.progress),
    [0, 0]
  );

  currentNow = 1_100;
  raceStore.advanceSimulation({ nowMs: currentNow });
  currentNow = 1_200;
  raceStore.advanceSimulation({ nowMs: currentNow });
  currentNow = 1_300;
  raceStore.advanceSimulation({ nowMs: currentNow });

  snapshot = raceStore.getSnapshot();
  assert.equal(snapshot.state, "FINISHED");
  assert.equal(snapshot.simulation.active, true);
  assert.equal(snapshot.activeSession.racers[0].lapCount, 3);
  assert.equal(snapshot.activeSession.racers[1].lapCount, 3);

  currentNow = 1_310;
  raceStore.advanceSimulation({ nowMs: currentNow });
  currentNow = 1_320;
  raceStore.advanceSimulation({ nowMs: currentNow });
  currentNow = 1_330;
  raceStore.advanceSimulation({ nowMs: currentNow });

  snapshot = raceStore.getSnapshot();
  assert.equal(snapshot.simulation.active, false);
  assert.equal(snapshot.simulation.status, "COMPLETED");
  assert.equal(snapshot.finishOrderActive, true);
  assert.equal(snapshot.leaderboard[0].racerId, amy.id);
  assert.equal(snapshot.leaderboard[0].finishPlace, 1);
  assert.equal(snapshot.leaderboard[1].racerId, ben.id);
  assert.equal(snapshot.leaderboard[1].finishPlace, 2);
});

test("simulation defaults to an 8-car, 5-lap foundation with 20-25 second lap targets", () => {
  const raceStore = createRaceStore({
    raceDurationSeconds: 600,
    now: () => 1_000,
  });

  const session = raceStore.createSession({ name: "Sprint 1 Sim Heat" });
  Array.from({ length: 8 }, (_unused, index) =>
    raceStore.addRacer(session.id, { name: `Racer ${index + 1}` })
  );

  raceStore.startSimulation({
    startedAtMs: 1_000,
    seed: 1234,
  });

  const snapshot = raceStore.getSnapshot();
  assert.equal(snapshot.state, "RUNNING");
  assert.equal(snapshot.simulation.active, true);
  assert.equal(snapshot.simulation.targetLapCount, 5);
  assert.equal(snapshot.simulation.racers.length, 8);
  assert.equal(
    snapshot.simulation.racers.every(
      (racer) =>
        racer.progress === 0 &&
        racer.lapIndex === 1 &&
        racer.targetLapDurationMs >= 20_000 &&
        racer.targetLapDurationMs <= 25_000
    ),
    true
  );
});

test("simulation honors hazard stop and enforces the hard time cap", () => {
  let currentNow = 5_000;
  const raceStore = createRaceStore({
    raceDurationSeconds: 600,
    now: () => currentNow,
    simulationConfig: {
      baselineLapMsMin: 100,
      baselineLapMsMax: 100,
      jitterMsMin: 0,
      jitterMsMax: 0,
      minLapDurationMs: 1,
      drainIntervalMs: 10,
      targetLapCount: 3,
      maxDurationMs: 150,
    },
  });

  const session = raceStore.createSession({ name: "Hazard Sim" });
  const racer = raceStore.addRacer(session.id, { name: "Casey", carNumber: "3" });

  raceStore.startSimulation({
    startedAtMs: currentNow,
    seed: 99,
    maxDurationMs: 150,
    targetLapCount: 3,
  });

  assert.throws(
    () => raceStore.recordLapCrossing({ racerId: racer.id, timestampMs: 5_010 }),
    /Manual lap input is blocked while simulation is active/
  );
  raceStore.setRaceMode("HAZARD_STOP");

  currentNow = 5_100;
  raceStore.advanceSimulation({ nowMs: currentNow });
  let snapshot = raceStore.getSnapshot();
  assert.equal(snapshot.activeSession.racers[0].lapCount, 0);

  raceStore.setRaceMode("SAFE");
  currentNow = 5_151;
  raceStore.advanceSimulation({ nowMs: currentNow });

  snapshot = raceStore.getSnapshot();
  assert.equal(snapshot.state, "FINISHED");
  assert.equal(snapshot.simulation.active, false);
  assert.equal(snapshot.simulation.hardCapReached, true);
  assert.equal(snapshot.simulation.completionReason, "hard_cap");
  assert.equal(snapshot.activeSession.racers[0].lapCount, 0);
});
