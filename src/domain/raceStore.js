const {
  RACE_FLAGS,
  RACE_MODES,
  RACE_STATES,
  canAcceptLapInput,
  canChangeMode,
  canTransition,
} = require("./raceStateMachine");

class DomainError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeOptionalString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function buildQueueView(sessions, activeSessionId) {
  const currentSession = activeSessionId
    ? sessions.find((session) => session.id === activeSessionId) || null
    : null;
  const queuedSessions = currentSession
    ? sessions.filter((session) => session.id !== currentSession.id)
    : sessions.slice();
  const nextSession = queuedSessions[0] || null;

  return {
    currentSessionId: currentSession ? currentSession.id : null,
    currentSession: currentSession ? clone(currentSession) : null,
    nextSessionId: nextSession ? nextSession.id : null,
    nextSession: nextSession ? clone(nextSession) : null,
    queuedSessionIds: queuedSessions.map((session) => session.id),
    queuedSessions: clone(queuedSessions),
  };
}

function createInitialState(raceDurationSeconds) {
  return {
    raceState: RACE_STATES.IDLE,
    raceMode: RACE_MODES.SAFE,
    raceFlag: RACE_FLAGS.SAFE,
    activeSessionId: null,
    sessions: [],
    remainingSeconds: raceDurationSeconds,
    timerEndsAt: null,
    lockedSession: null,
    lockedLeaderboard: [],
    nextSessionId: 1,
    nextRacerId: 1,
  };
}

function normalizeRestoredRacer(racer) {
  return {
    ...racer,
    finishPlace: Number.isFinite(racer?.finishPlace) ? racer.finishPlace : null,
    finishRecordedAtMs: Number.isFinite(racer?.finishRecordedAtMs)
      ? racer.finishRecordedAtMs
      : null,
  };
}

function normalizeRestoredSession(session) {
  return {
    ...session,
    racers: Array.isArray(session?.racers)
      ? session.racers.map(normalizeRestoredRacer)
      : [],
  };
}

function normalizeRestoredLeaderboardEntry(entry) {
  return {
    ...entry,
    finishPlace: Number.isFinite(entry?.finishPlace) ? entry.finishPlace : null,
  };
}

function normalizeRestoredState(restoredState, raceDurationSeconds) {
  const baseState = createInitialState(raceDurationSeconds);
  if (!restoredState) {
    return baseState;
  }

  return {
    ...baseState,
    ...clone(restoredState),
    sessions: Array.isArray(restoredState.sessions)
      ? restoredState.sessions.map(normalizeRestoredSession)
      : [],
    lockedSession: restoredState.lockedSession
      ? normalizeRestoredSession(restoredState.lockedSession)
      : null,
    lockedLeaderboard: Array.isArray(restoredState.lockedLeaderboard)
      ? restoredState.lockedLeaderboard.map(normalizeRestoredLeaderboardEntry)
      : [],
  };
}

function createRaceStore({
  raceDurationSeconds,
  now = () => Date.now(),
  restoredState = null,
}) {
  const state = normalizeRestoredState(restoredState, raceDurationSeconds);

  function ensure(condition, code, message, status = 400) {
    if (!condition) {
      throw new DomainError(code, message, status);
    }
  }

  function transitionTo(nextState, code = "INVALID_STATE_TRANSITION") {
    ensure(
      canTransition(state.raceState, nextState),
      code,
      `Blocked race state transition: ${state.raceState} -> ${nextState}`,
      409
    );
    state.raceState = nextState;
  }

  function resetRaceClock() {
    state.remainingSeconds = raceDurationSeconds;
    state.timerEndsAt = null;
  }

  function resetLockedPresentation() {
    state.lockedSession = null;
    state.lockedLeaderboard = [];
  }

  function syncFlagFromState() {
    if (state.raceState === RACE_STATES.FINISHED) {
      state.raceFlag = RACE_FLAGS.CHECKERED;
      return;
    }

    if (state.raceState === RACE_STATES.LOCKED) {
      state.raceFlag = RACE_FLAGS.LOCKED;
      return;
    }

    state.raceFlag = state.raceMode;
  }

  syncFlagFromState();

  function getSessionIndex(sessionId) {
    return state.sessions.findIndex((session) => session.id === sessionId);
  }

  function getSession(sessionId, code = "SESSION_NOT_FOUND") {
    const session = state.sessions.find((item) => item.id === sessionId);
    ensure(session, code, `Session ${sessionId} was not found.`, 404);
    return session;
  }

  function getActiveSession(code = "ACTIVE_SESSION_REQUIRED") {
    ensure(state.activeSessionId, code, "An active session is required.", 409);
    return getSession(state.activeSessionId, code);
  }

  function assignActiveSession(sessionId) {
    state.activeSessionId = sessionId;
    resetLockedPresentation();

    if (state.raceState === RACE_STATES.IDLE) {
      transitionTo(RACE_STATES.STAGING, "SESSION_SELECTION_BLOCKED");
    } else if (state.raceState === RACE_STATES.LOCKED) {
      transitionTo(RACE_STATES.STAGING, "SESSION_SELECTION_BLOCKED");
    }

    resetRaceClock();
    state.raceMode = RACE_MODES.SAFE;
    syncFlagFromState();
  }

  function assertSessionMutationAllowed(sessionId, code, message) {
    if (state.activeSessionId !== sessionId) {
      return;
    }

    ensure(
      state.raceState !== RACE_STATES.RUNNING && state.raceState !== RACE_STATES.FINISHED,
      code,
      message,
      409
    );
  }

  function createSession({ name }) {
    const session = {
      id: `session-${state.nextSessionId++}`,
      name: name.trim(),
      racers: [],
      createdAt: new Date(now()).toISOString(),
      updatedAt: new Date(now()).toISOString(),
    };

    state.sessions.push(session);
    if (!state.activeSessionId) {
      assignActiveSession(session.id);
    }

    return clone(session);
  }

  function updateSession(sessionId, { name }) {
    const session = getSession(sessionId);
    assertSessionMutationAllowed(
      sessionId,
      "SESSION_EDIT_FORBIDDEN",
      "Current session cannot be edited while the race is running or finished."
    );

    if (typeof name === "string") {
      session.name = name.trim();
    }
    session.updatedAt = new Date(now()).toISOString();

    return clone(session);
  }

  function deleteSession(sessionId) {
    const session = getSession(sessionId);
    assertSessionMutationAllowed(
      sessionId,
      "SESSION_DELETE_FORBIDDEN",
      "Current session cannot be deleted while the race is running or finished."
    );

    state.sessions = state.sessions.filter((item) => item.id !== session.id);

    if (state.activeSessionId === sessionId) {
      state.activeSessionId = null;

      if (state.sessions.length > 0) {
        state.activeSessionId = state.sessions[0].id;
        if (state.raceState === RACE_STATES.IDLE || state.raceState === RACE_STATES.LOCKED) {
          assignActiveSession(state.activeSessionId);
        } else {
          resetRaceClock();
          state.raceMode = RACE_MODES.SAFE;
          syncFlagFromState();
        }
      } else if (state.raceState !== RACE_STATES.LOCKED) {
        state.raceState = RACE_STATES.IDLE;
        resetRaceClock();
        state.raceMode = RACE_MODES.SAFE;
        syncFlagFromState();
      }
    }

    return clone(session);
  }

  function selectSession(sessionId) {
    ensure(
      state.raceState !== RACE_STATES.RUNNING && state.raceState !== RACE_STATES.FINISHED,
      "SESSION_SELECTION_BLOCKED",
      "Cannot switch sessions while the current race is active.",
      409
    );

    const session = getSession(sessionId);
    assignActiveSession(session.id);
    return clone(session);
  }

  function ensureUniqueRacerName(session, racerName, excludeRacerId = null) {
    const normalizedName = racerName.trim().toLowerCase();
    const duplicate = session.racers.find((racer) => {
      if (excludeRacerId && racer.id === excludeRacerId) {
        return false;
      }

      return racer.name.trim().toLowerCase() === normalizedName;
    });

    ensure(
      !duplicate,
      "DUPLICATE_RACER_NAME",
      `Racer name "${racerName}" already exists in this session.`,
      409
    );
  }

  function addRacer(sessionId, { name, carNumber }) {
    const session = getSession(sessionId);
    assertSessionMutationAllowed(
      sessionId,
      "SESSION_EDIT_FORBIDDEN",
      "Current session cannot be edited while the race is running or finished."
    );
    ensureUniqueRacerName(session, name);

    const racer = {
      id: `racer-${state.nextRacerId++}`,
      name: name.trim(),
      carNumber: normalizeOptionalString(carNumber),
      lapCount: 0,
      currentLapTimeMs: null,
      bestLapTimeMs: null,
      lastCrossingTimestampMs: null,
      finishPlace: null,
      finishRecordedAtMs: null,
      createdAt: new Date(now()).toISOString(),
      updatedAt: new Date(now()).toISOString(),
    };

    session.racers.push(racer);
    session.updatedAt = new Date(now()).toISOString();

    return clone(racer);
  }

  function updateRacer(sessionId, racerId, { name, carNumber }) {
    const session = getSession(sessionId);
    assertSessionMutationAllowed(
      sessionId,
      "SESSION_EDIT_FORBIDDEN",
      "Current session cannot be edited while the race is running or finished."
    );
    const racer = session.racers.find((item) => item.id === racerId);
    ensure(racer, "RACER_NOT_FOUND", `Racer ${racerId} was not found.`, 404);

    if (typeof name === "string") {
      ensureUniqueRacerName(session, name, racerId);
      racer.name = name.trim();
    }

    if (carNumber !== undefined) {
      racer.carNumber = normalizeOptionalString(carNumber);
    }

    racer.updatedAt = new Date(now()).toISOString();
    session.updatedAt = new Date(now()).toISOString();

    return clone(racer);
  }

  function removeRacer(sessionId, racerId) {
    const session = getSession(sessionId);
    assertSessionMutationAllowed(
      sessionId,
      "SESSION_EDIT_FORBIDDEN",
      "Current session cannot be edited while the race is running or finished."
    );
    const racer = session.racers.find((item) => item.id === racerId);
    ensure(racer, "RACER_NOT_FOUND", `Racer ${racerId} was not found.`, 404);

    session.racers = session.racers.filter((item) => item.id !== racerId);
    session.updatedAt = new Date(now()).toISOString();

    return clone(racer);
  }

  function resetLapData(session) {
    session.racers.forEach((racer) => {
      racer.lapCount = 0;
      racer.currentLapTimeMs = null;
      racer.bestLapTimeMs = null;
      racer.lastCrossingTimestampMs = null;
      racer.finishPlace = null;
      racer.finishRecordedAtMs = null;
      racer.updatedAt = new Date(now()).toISOString();
    });
  }

  function getRecordedFinishCount(session) {
    return session.racers.reduce(
      (count, racer) => count + (Number.isFinite(racer.finishPlace) ? 1 : 0),
      0
    );
  }

  function sortCompetitiveEntries(left, right) {
    if (left.bestLapTimeMs === null && right.bestLapTimeMs === null) {
      return left.name.localeCompare(right.name);
    }

    if (left.bestLapTimeMs === null) {
      return 1;
    }

    if (right.bestLapTimeMs === null) {
      return -1;
    }

    if (left.bestLapTimeMs !== right.bestLapTimeMs) {
      return left.bestLapTimeMs - right.bestLapTimeMs;
    }

    return right.lapCount - left.lapCount;
  }

  function sortLeaderboardEntries(entries) {
    const finishOrderActive = entries.some((entry) => Number.isFinite(entry.finishPlace));
    return entries.slice().sort((left, right) => {
      if (finishOrderActive) {
        const leftFinished = Number.isFinite(left.finishPlace);
        const rightFinished = Number.isFinite(right.finishPlace);

        if (leftFinished && rightFinished && left.finishPlace !== right.finishPlace) {
          return left.finishPlace - right.finishPlace;
        }

        if (leftFinished !== rightFinished) {
          return leftFinished ? -1 : 1;
        }
      }

      return sortCompetitiveEntries(left, right);
    });
  }

  function startRace() {
    const activeSession = getActiveSession("START_BLOCKED");
    ensure(
      state.raceState === RACE_STATES.STAGING,
      "START_BLOCKED",
      "Race can only start from STAGING.",
      409
    );

    resetLapData(activeSession);
    state.raceMode = RACE_MODES.SAFE;
    state.remainingSeconds = raceDurationSeconds;
    state.timerEndsAt = null;
    resetLockedPresentation();
    transitionTo(RACE_STATES.RUNNING, "START_BLOCKED");
    syncFlagFromState();

    return clone(activeSession);
  }

  function setRaceMode(mode) {
    ensure(
      Object.values(RACE_MODES).includes(mode),
      "INVALID_RACE_MODE",
      `Unknown race mode: ${mode}.`
    );
    ensure(
      canChangeMode(state.raceState),
      "MODE_CHANGE_BLOCKED",
      "Race mode can only be changed while RUNNING.",
      409
    );

    state.raceMode = mode;
    syncFlagFromState();
    return state.raceMode;
  }

  function syncTimer({ remainingSeconds, endsAt }) {
    state.remainingSeconds = Math.max(0, remainingSeconds);
    state.timerEndsAt = endsAt || null;
  }

  function finishRace({ reason = "manual" } = {}) {
    ensure(
      state.raceState === RACE_STATES.RUNNING,
      "FINISH_BLOCKED",
      "Race can only finish from RUNNING.",
      409
    );

    state.remainingSeconds = 0;
    state.timerEndsAt = null;
    transitionTo(RACE_STATES.FINISHED, "FINISH_BLOCKED");
    syncFlagFromState();

    return { reason };
  }

  function lockRace() {
    const activeSession = getActiveSession("LOCK_BLOCKED");
    ensure(
      state.raceState === RACE_STATES.FINISHED,
      "LOCK_BLOCKED",
      "Race can only lock from FINISHED.",
      409
    );

    state.lockedSession = clone(activeSession);
    state.lockedLeaderboard = clone(buildLeaderboard());
    transitionTo(RACE_STATES.LOCKED, "LOCK_BLOCKED");
    state.sessions = state.sessions.filter((session) => session.id !== activeSession.id);
    state.activeSessionId = null;
    resetRaceClock();
    state.raceMode = RACE_MODES.SAFE;
    syncFlagFromState();

    return clone(activeSession);
  }

  function recordLapCrossing({ racerId, timestampMs = now() }) {
    ensure(
      canAcceptLapInput(state.raceState),
      "LAP_INPUT_BLOCKED",
      "Lap input is only allowed while RUNNING or FINISHED.",
      409
    );

    const activeSession = getActiveSession("LAP_INPUT_BLOCKED");
    const racer = activeSession.racers.find((item) => item.id === racerId);
    ensure(racer, "RACER_NOT_FOUND", `Racer ${racerId} was not found.`, 404);

    if (state.raceState === RACE_STATES.FINISHED && Number.isFinite(racer.finishPlace)) {
      return clone(racer);
    }

    racer.lapCount += 1;
    if (racer.lastCrossingTimestampMs !== null) {
      const lapDeltaMs = timestampMs - racer.lastCrossingTimestampMs;
      // Ignore non-monotonic crossings so realtime schemas never receive invalid lap times.
      if (lapDeltaMs > 0) {
        racer.currentLapTimeMs = lapDeltaMs;
        if (
          racer.bestLapTimeMs === null ||
          racer.currentLapTimeMs < racer.bestLapTimeMs
        ) {
          racer.bestLapTimeMs = racer.currentLapTimeMs;
        }
      }
    } else {
      racer.lastCrossingTimestampMs = timestampMs;
    }

    if (racer.lastCrossingTimestampMs === null || timestampMs > racer.lastCrossingTimestampMs) {
      racer.lastCrossingTimestampMs = timestampMs;
    }
    if (state.raceState === RACE_STATES.FINISHED && !Number.isFinite(racer.finishPlace)) {
      racer.finishPlace = getRecordedFinishCount(activeSession) + 1;
      racer.finishRecordedAtMs = timestampMs;
    }
    racer.updatedAt = new Date(now()).toISOString();
    activeSession.updatedAt = new Date(now()).toISOString();

    return clone(racer);
  }

  function buildLeaderboard() {
    if (state.raceState === RACE_STATES.LOCKED) {
      return clone(state.lockedLeaderboard);
    }

    const activeSession = state.activeSessionId
      ? state.sessions.find((session) => session.id === state.activeSessionId)
      : null;

    if (!activeSession) {
      return [];
    }

    return sortLeaderboardEntries(
      activeSession.racers.map((racer) => ({
        racerId: racer.id,
        name: racer.name,
        carNumber: racer.carNumber,
        lapCount: racer.lapCount,
        currentLapTimeMs: racer.currentLapTimeMs,
        bestLapTimeMs: racer.bestLapTimeMs,
        finishPlace: Number.isFinite(racer.finishPlace) ? racer.finishPlace : null,
      }))
    )
      .map((entry, index) => ({
        position: Number.isFinite(entry.finishPlace) ? entry.finishPlace : index + 1,
        ...entry,
      }));
  }

  function getSnapshot() {
    const activeSession = state.activeSessionId
      ? state.sessions.find((session) => session.id === state.activeSessionId)
      : null;
    const queueView = buildQueueView(state.sessions, state.activeSessionId);

    return {
      state: state.raceState,
      mode: state.raceMode,
      flag: state.raceFlag,
      lapEntryAllowed: canAcceptLapInput(state.raceState),
      raceDurationSeconds,
      remainingSeconds: state.remainingSeconds,
      endsAt: state.timerEndsAt,
      activeSessionId: state.activeSessionId,
      activeSession: activeSession ? clone(activeSession) : null,
      currentSessionId: queueView.currentSessionId,
      currentSession: queueView.currentSession,
      nextSessionId: queueView.nextSessionId,
      nextSession: queueView.nextSession,
      queuedSessionIds: queueView.queuedSessionIds,
      queuedSessions: queueView.queuedSessions,
      finishOrderActive:
        state.raceState === RACE_STATES.FINISHED || state.raceState === RACE_STATES.LOCKED,
      lockedSession: state.lockedSession ? clone(state.lockedSession) : null,
      sessions: clone(state.sessions),
      leaderboard: buildLeaderboard(),
    };
  }

  function exportState() {
    return clone(state);
  }

  return {
    DomainError,
    addRacer,
    createSession,
    deleteSession,
    exportState,
    finishRace,
    getSnapshot,
    lockRace,
    recordLapCrossing,
    removeRacer,
    selectSession,
    setRaceMode,
    startRace,
    syncTimer,
    updateRacer,
    updateSession,
  };
}

module.exports = {
  DomainError,
  createRaceStore,
};
