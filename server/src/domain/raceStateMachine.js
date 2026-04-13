const RACE_STATES = Object.freeze({
  IDLE: "IDLE",
  STAGING: "STAGING",
  RUNNING: "RUNNING",
  FINISHED: "FINISHED",
  LOCKED: "LOCKED",
});

const RACE_MODES = Object.freeze({
  SAFE: "SAFE",
  HAZARD_SLOW: "HAZARD_SLOW",
  HAZARD_STOP: "HAZARD_STOP",
});

const RACE_FLAGS = Object.freeze({
  SAFE: "SAFE",
  HAZARD_SLOW: "HAZARD_SLOW",
  HAZARD_STOP: "HAZARD_STOP",
  CHECKERED: "CHECKERED",
  LOCKED: "LOCKED",
});

const ALLOWED_TRANSITIONS = Object.freeze({
  [RACE_STATES.IDLE]: new Set([RACE_STATES.STAGING]),
  [RACE_STATES.STAGING]: new Set([RACE_STATES.RUNNING]),
  [RACE_STATES.RUNNING]: new Set([RACE_STATES.FINISHED]),
  [RACE_STATES.FINISHED]: new Set([RACE_STATES.LOCKED]),
  [RACE_STATES.LOCKED]: new Set([RACE_STATES.STAGING]),
});

function canTransition(fromState, toState) {
  if (fromState === toState) {
    return false;
  }

  const allowedTargets = ALLOWED_TRANSITIONS[fromState];
  return Boolean(allowedTargets && allowedTargets.has(toState));
}

function canAcceptLapInput(state) {
  return state === RACE_STATES.RUNNING || state === RACE_STATES.FINISHED;
}

function canChangeMode(state) {
  return state === RACE_STATES.RUNNING;
}

module.exports = {
  RACE_FLAGS,
  RACE_STATES,
  RACE_MODES,
  canAcceptLapInput,
  canChangeMode,
  canTransition,
};
