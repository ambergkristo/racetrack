const {
  RACE_MODES,
  RACE_STATES,
  canAcceptLapInput,
} = require("./raceStateMachine");

const RACE_FLAGS = Object.freeze({
  IDLE: "IDLE",
  STAGING: "STAGING",
  SAFE: RACE_MODES.SAFE,
  HAZARD_SLOW: RACE_MODES.HAZARD_SLOW,
  HAZARD_STOP: RACE_MODES.HAZARD_STOP,
  CHECKERED: "CHECKERED",
  LOCKED: "LOCKED",
});

const STATE_LABELS = Object.freeze({
  [RACE_STATES.IDLE]: "Idle",
  [RACE_STATES.STAGING]: "Staging",
  [RACE_STATES.RUNNING]: "Running",
  [RACE_STATES.FINISHED]: "Finished",
  [RACE_STATES.LOCKED]: "Locked",
});

const STATE_DESCRIPTIONS = Object.freeze({
  [RACE_STATES.IDLE]: "No session is staged yet.",
  [RACE_STATES.STAGING]: "A session is staged and ready to start.",
  [RACE_STATES.RUNNING]: "Race is live and lap input is accepted.",
  [RACE_STATES.FINISHED]:
    "Finish has been called. Post-finish laps are still accepted until lock.",
  [RACE_STATES.LOCKED]:
    "Race is locked. Results are final and lap input is blocked.",
});

function resolveFlag({ state, mode }) {
  if (state === RACE_STATES.RUNNING) {
    return mode;
  }

  if (state === RACE_STATES.FINISHED) {
    return RACE_FLAGS.CHECKERED;
  }

  if (state === RACE_STATES.LOCKED) {
    return RACE_FLAGS.LOCKED;
  }

  if (state === RACE_STATES.STAGING) {
    return RACE_FLAGS.STAGING;
  }

  return RACE_FLAGS.IDLE;
}

function buildRaceStateTruth(snapshot) {
  return {
    flag: resolveFlag(snapshot),
    lapEntryAllowed: canAcceptLapInput(snapshot.state),
    resultsFinalized: snapshot.state === RACE_STATES.LOCKED,
    stateLabel: STATE_LABELS[snapshot.state],
    stateDescription: STATE_DESCRIPTIONS[snapshot.state],
  };
}

module.exports = {
  RACE_FLAGS,
  buildRaceStateTruth,
};
