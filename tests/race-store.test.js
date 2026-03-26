const assert = require("node:assert/strict");
const { createRaceStore } = require("../src/domain/raceStore");
const { test } = require("./helpers/testHarness");

test("race store ignores non-positive lap deltas without corrupting leaderboard timing", () => {
  const raceStore = createRaceStore({
    raceDurationSeconds: 60,
    now: () => 1_000,
  });

  const session = raceStore.createSession({ name: "Heat 1" });
  const racer = raceStore.addRacer(session.id, {
    name: "Amy",
    carNumber: "7",
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
    carNumber: "8",
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
  assert.equal(snapshot.currentSessionId, null);
  assert.equal(snapshot.currentSession, null);
  assert.equal(snapshot.nextSessionId, heat2.id);
  assert.deepEqual(snapshot.queuedSessionIds, [heat2.id]);
});
