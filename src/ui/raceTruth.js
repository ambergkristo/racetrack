const { canAcceptLapInput, RACE_MODES, RACE_STATES } = require("../domain/raceStateMachine");

const RACE_FLAGS = Object.freeze({
  IDLE: "IDLE",
  STAGING: "STAGING",
  SAFE: RACE_MODES.SAFE,
  HAZARD_SLOW: RACE_MODES.HAZARD_SLOW,
  HAZARD_STOP: RACE_MODES.HAZARD_STOP,
  CHECKERED: "CHECKERED",
  LOCKED: "LOCKED",
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeLockedSnapshotContext(value = null) {
  return {
    lockedSession: value?.lockedSession ? clone(value.lockedSession) : null,
    finalResults: Array.isArray(value?.finalResults) ? clone(value.finalResults) : null,
  };
}

function resolveFlag(snapshot) {
  switch (snapshot.state) {
    case RACE_STATES.RUNNING:
      return snapshot.mode;
    case RACE_STATES.FINISHED:
      return RACE_FLAGS.CHECKERED;
    case RACE_STATES.LOCKED:
      return RACE_FLAGS.LOCKED;
    default:
      return snapshot.mode;
  }
}

function resolveNextSession(snapshot) {
  if (!Array.isArray(snapshot.sessions)) {
    return null;
  }

  const nextSession = snapshot.sessions.find((session) => session.id !== snapshot.activeSessionId);
  return nextSession ? clone(nextSession) : null;
}

function resolveFinalResults(snapshot, lockedSnapshotContext) {
  if (snapshot.state === RACE_STATES.FINISHED) {
    return clone(snapshot.leaderboard);
  }

  if (snapshot.state === RACE_STATES.LOCKED) {
    return lockedSnapshotContext.finalResults === null
      ? null
      : clone(lockedSnapshotContext.finalResults);
  }

  return null;
}

function buildRaceSnapshotViewModel(snapshot, lockedSnapshotContext = null) {
  const normalizedLockedSnapshotContext =
    normalizeLockedSnapshotContext(lockedSnapshotContext);

  return {
    ...snapshot,
    flag: resolveFlag(snapshot),
    lapEntryAllowed: canAcceptLapInput(snapshot.state),
    nextSession: resolveNextSession(snapshot),
    lockedSession:
      snapshot.state === RACE_STATES.LOCKED
        ? normalizedLockedSnapshotContext.lockedSession
        : null,
    finalResults: resolveFinalResults(snapshot, normalizedLockedSnapshotContext),
  };
}

module.exports = {
  RACE_FLAGS,
  buildRaceSnapshotViewModel,
  normalizeLockedSnapshotContext,
};
