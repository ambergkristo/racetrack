const test = require("node:test");
const assert = require("node:assert/strict");
const { createPublicRaceFeed } = require("../src/public-race-feed");

test("public race feed advances through M1 phases with deterministic payloads", () => {
  const feed = createPublicRaceFeed({
    raceDurationSeconds: 20,
    initialElapsedSeconds: 0,
    now: () => new Date("2026-03-11T08:00:00.000Z"),
  });

  const openingState = feed.getState();
  assert.equal(openingState.snapshot.phase, "STAGING");
  assert.equal(openingState.snapshot.currentRace.title, "Heat 01");
  assert.equal(openingState.leaderboard.entries.length, 6);

  const runningState = feed.advance(12);
  assert.equal(runningState.snapshot.phase, "RUNNING");
  assert.equal(runningState.tick.flagCode, "SAFE");

  const finishedState = feed.advance(20);
  assert.equal(finishedState.snapshot.phase, "FINISHED");
  assert.equal(finishedState.snapshot.flag.code, "FINISHED");

  const lockedState = feed.advance(10);
  assert.equal(lockedState.snapshot.phase, "LOCKED");
  assert.equal(lockedState.snapshot.nextRace.number, 2);
});
