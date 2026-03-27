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

function resolveQueueView(snapshot) {
  const sessions = Array.isArray(snapshot.sessions) ? snapshot.sessions : [];
  const currentSession =
    snapshot.currentSession ||
    (snapshot.activeSessionId
      ? sessions.find((session) => session.id === snapshot.activeSessionId) || null
      : null);
  const queuedSessions =
    snapshot.queuedSessions ||
    sessions.filter((session) => session.id !== (currentSession?.id || snapshot.activeSessionId));
  const nextSession =
    snapshot.nextSession ||
    (queuedSessions.length > 0 ? queuedSessions[0] : resolveNextSession(snapshot));

  return {
    currentSessionId: currentSession ? currentSession.id : null,
    currentSession: currentSession ? clone(currentSession) : null,
    nextSessionId: nextSession ? nextSession.id : null,
    nextSession: nextSession ? clone(nextSession) : null,
    queuedSessionIds: queuedSessions.map((session) => session.id),
    queuedSessions: clone(queuedSessions),
  };
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
  const queueView = resolveQueueView(snapshot);

  return {
    ...snapshot,
    stateLabel: STATE_LABELS[snapshot.state],
    stateDescription: STATE_DESCRIPTIONS[snapshot.state],
    flag: resolveFlag(snapshot),
    lapEntryAllowed: canAcceptLapInput(snapshot.state),
    resultsFinalized: snapshot.state === RACE_STATES.LOCKED,
    finishOrderActive: Boolean(snapshot.finishOrderActive),
    currentSessionId: queueView.currentSessionId,
    currentSession: queueView.currentSession,
    nextSessionId: queueView.nextSessionId,
    nextSession: queueView.nextSession,
    queuedSessionIds: queueView.queuedSessionIds,
    queuedSessions: queueView.queuedSessions,
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
