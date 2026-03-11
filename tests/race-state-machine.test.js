const assert = require("node:assert/strict");
const { test } = require("./helpers/testHarness");
const {
  RACE_STATES,
  canAcceptLapInput,
  canChangeMode,
  canTransition,
} = require("../src/domain/raceStateMachine");

test("race state machine allows only the milestone transitions", () => {
  assert.equal(canTransition(RACE_STATES.IDLE, RACE_STATES.STAGING), true);
  assert.equal(canTransition(RACE_STATES.STAGING, RACE_STATES.RUNNING), true);
  assert.equal(canTransition(RACE_STATES.RUNNING, RACE_STATES.FINISHED), true);
  assert.equal(canTransition(RACE_STATES.FINISHED, RACE_STATES.LOCKED), true);
  assert.equal(canTransition(RACE_STATES.LOCKED, RACE_STATES.STAGING), true);

  assert.equal(canTransition(RACE_STATES.FINISHED, RACE_STATES.RUNNING), false);
  assert.equal(canTransition(RACE_STATES.LOCKED, RACE_STATES.RUNNING), false);
  assert.equal(canTransition(RACE_STATES.RUNNING, RACE_STATES.STAGING), false);
  assert.equal(canTransition(RACE_STATES.RUNNING, RACE_STATES.RUNNING), false);
});

test("lap input and mode changes stay constrained to running flow", () => {
  assert.equal(canAcceptLapInput(RACE_STATES.IDLE), false);
  assert.equal(canAcceptLapInput(RACE_STATES.STAGING), false);
  assert.equal(canAcceptLapInput(RACE_STATES.RUNNING), true);
  assert.equal(canAcceptLapInput(RACE_STATES.FINISHED), true);
  assert.equal(canAcceptLapInput(RACE_STATES.LOCKED), false);

  assert.equal(canChangeMode(RACE_STATES.STAGING), false);
  assert.equal(canChangeMode(RACE_STATES.RUNNING), true);
  assert.equal(canChangeMode(RACE_STATES.FINISHED), false);
});
