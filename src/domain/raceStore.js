const {
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

function createRaceStore({ raceDurationSeconds, now = () => Date.now() }) {
  const state = {
    raceState: RACE_STATES.IDLE,
    raceMode: RACE_MODES.SAFE,
    activeSessionId: null,
    sessions: [],
    remainingSeconds: raceDurationSeconds,
    timerEndsAt: null,
    nextSessionId: 1,
    nextRacerId: 1,
  };

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

    if (state.raceState === RACE_STATES.IDLE) {
      transitionTo(RACE_STATES.STAGING, "SESSION_SELECTION_BLOCKED");
    } else if (state.raceState === RACE_STATES.LOCKED) {
      transitionTo(RACE_STATES.STAGING, "SESSION_SELECTION_BLOCKED");
    }

    resetRaceClock();
    state.raceMode = RACE_MODES.SAFE;
  }

  function assertEditableSession(sessionId) {
    if (state.activeSessionId !== sessionId) {
      return;
    }

    ensure(
      state.raceState !== RACE_STATES.RUNNING && state.raceState !== RACE_STATES.FINISHED,
      "SESSION_EDIT_BLOCKED",
      "Active session cannot be edited while the race is running or finished.",
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
    assertEditableSession(sessionId);

    if (typeof name === "string") {
      session.name = name.trim();
    }
    session.updatedAt = new Date(now()).toISOString();

    return clone(session);
  }

  function deleteSession(sessionId) {
    const session = getSession(sessionId);
    assertEditableSession(sessionId);

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
        }
      } else if (state.raceState !== RACE_STATES.LOCKED) {
        state.raceState = RACE_STATES.IDLE;
        resetRaceClock();
        state.raceMode = RACE_MODES.SAFE;
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
    assertEditableSession(sessionId);
    ensureUniqueRacerName(session, name);

    const racer = {
      id: `racer-${state.nextRacerId++}`,
      name: name.trim(),
      carNumber: normalizeOptionalString(carNumber),
      lapCount: 0,
      currentLapTimeMs: null,
      bestLapTimeMs: null,
      lastCrossingTimestampMs: null,
      createdAt: new Date(now()).toISOString(),
      updatedAt: new Date(now()).toISOString(),
    };

    session.racers.push(racer);
    session.updatedAt = new Date(now()).toISOString();

    return clone(racer);
  }

  function updateRacer(sessionId, racerId, { name, carNumber }) {
    const session = getSession(sessionId);
    assertEditableSession(sessionId);
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
    assertEditableSession(sessionId);
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
      racer.updatedAt = new Date(now()).toISOString();
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
    transitionTo(RACE_STATES.RUNNING, "START_BLOCKED");

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

    transitionTo(RACE_STATES.LOCKED, "LOCK_BLOCKED");
    state.sessions = state.sessions.filter((session) => session.id !== activeSession.id);
    state.activeSessionId = null;
    resetRaceClock();
    state.raceMode = RACE_MODES.SAFE;

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
    racer.updatedAt = new Date(now()).toISOString();
    activeSession.updatedAt = new Date(now()).toISOString();

    return clone(racer);
  }

  function buildLeaderboard() {
    const activeSession = state.activeSessionId
      ? state.sessions.find((session) => session.id === state.activeSessionId)
      : null;

    if (!activeSession) {
      return [];
    }

    return activeSession.racers
      .map((racer) => ({
        racerId: racer.id,
        name: racer.name,
        carNumber: racer.carNumber,
        lapCount: racer.lapCount,
        currentLapTimeMs: racer.currentLapTimeMs,
        bestLapTimeMs: racer.bestLapTimeMs,
      }))
      .sort((left, right) => {
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
      })
      .map((entry, index) => ({
        position: index + 1,
        ...entry,
      }));
  }

  function getSnapshot() {
    const activeSession = state.activeSessionId
      ? state.sessions.find((session) => session.id === state.activeSessionId)
      : null;

    return {
      state: state.raceState,
      mode: state.raceMode,
      raceDurationSeconds,
      remainingSeconds: state.remainingSeconds,
      endsAt: state.timerEndsAt,
      activeSessionId: state.activeSessionId,
      activeSession: activeSession ? clone(activeSession) : null,
      sessions: clone(state.sessions),
      leaderboard: buildLeaderboard(),
    };
  }

  return {
    DomainError,
    addRacer,
    createSession,
    deleteSession,
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
