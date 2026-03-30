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

const DEFAULT_SIMULATION_CONFIG = Object.freeze({
  maxDurationMs: 600_000,
  targetLapCount: 3,
  baselineLapMsMin: 22_000,
  baselineLapMsMax: 30_000,
  jitterMsMin: 450,
  jitterMsMax: 1_250,
  minLapDurationMs: 6_000,
  drainIntervalMs: 650,
  hazardSlowFactor: 0.45,
});

const SIMULATION_STATUSES = Object.freeze({
  IDLE: "IDLE",
  READY: "READY",
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
});

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function hashString(value) {
  let hash = 2166136261;
  const source = String(value);
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededUnit(seed) {
  let value = seed >>> 0;
  value += 0x6d2b79f5;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function createSimulationState() {
  return {
    status: SIMULATION_STATUSES.IDLE,
    active: false,
    seed: null,
    sessionId: null,
    startedAtMs: null,
    endedAtMs: null,
    maxDurationMs: null,
    targetLapCount: null,
    hardCapReached: false,
    completionReason: null,
    finishQueue: [],
    finishQueueNextAtMs: null,
    racerOrder: [],
    racers: [],
  };
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
    simulation: createSimulationState(),
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

function normalizeRestoredSimulationRacer(racer) {
  return {
    ...racer,
    seed: Number.isFinite(racer?.seed) ? racer.seed : null,
    baselineLapMs: Number.isFinite(racer?.baselineLapMs) ? racer.baselineLapMs : null,
    jitterMs: Number.isFinite(racer?.jitterMs) ? racer.jitterMs : null,
    consistencyFactor: Number.isFinite(racer?.consistencyFactor)
      ? racer.consistencyFactor
      : 1,
    lapIndex: Number.isFinite(racer?.lapIndex) ? racer.lapIndex : 1,
    targetLapDurationMs: Number.isFinite(racer?.targetLapDurationMs)
      ? racer.targetLapDurationMs
      : null,
    lapProgressMs: Number.isFinite(racer?.lapProgressMs) ? racer.lapProgressMs : 0,
    lastAdvancedAtMs: Number.isFinite(racer?.lastAdvancedAtMs) ? racer.lastAdvancedAtMs : null,
    targetCompleted: Boolean(racer?.targetCompleted),
    targetCompletedAtMs: Number.isFinite(racer?.targetCompletedAtMs)
      ? racer.targetCompletedAtMs
      : null,
  };
}

function normalizeRestoredSimulation(simulation) {
  return {
    ...createSimulationState(),
    ...clone(simulation || {}),
    status: Object.values(SIMULATION_STATUSES).includes(simulation?.status)
      ? simulation.status
      : SIMULATION_STATUSES.IDLE,
    active: Boolean(simulation?.active),
    seed: Number.isFinite(simulation?.seed) ? simulation.seed : null,
    sessionId: typeof simulation?.sessionId === "string" ? simulation.sessionId : null,
    startedAtMs: Number.isFinite(simulation?.startedAtMs) ? simulation.startedAtMs : null,
    endedAtMs: Number.isFinite(simulation?.endedAtMs) ? simulation.endedAtMs : null,
    maxDurationMs: Number.isFinite(simulation?.maxDurationMs)
      ? simulation.maxDurationMs
      : null,
    targetLapCount: Number.isFinite(simulation?.targetLapCount)
      ? simulation.targetLapCount
      : null,
    hardCapReached: Boolean(simulation?.hardCapReached),
    completionReason:
      typeof simulation?.completionReason === "string" ? simulation.completionReason : null,
    finishQueue: Array.isArray(simulation?.finishQueue)
      ? simulation.finishQueue.filter((value) => typeof value === "string")
      : [],
    finishQueueNextAtMs: Number.isFinite(simulation?.finishQueueNextAtMs)
      ? simulation.finishQueueNextAtMs
      : null,
    racerOrder: Array.isArray(simulation?.racerOrder)
      ? simulation.racerOrder.filter((value) => typeof value === "string")
      : [],
    racers: Array.isArray(simulation?.racers)
      ? simulation.racers.map(normalizeRestoredSimulationRacer)
      : [],
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
    simulation: normalizeRestoredSimulation(restoredState.simulation),
  };
}

function createRaceStore({
  raceDurationSeconds,
  now = () => Date.now(),
  restoredState = null,
  simulationConfig = {},
}) {
  const state = normalizeRestoredState(restoredState, raceDurationSeconds);
  const simConfig = {
    ...DEFAULT_SIMULATION_CONFIG,
    ...simulationConfig,
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

  function resetLockedPresentation() {
    state.lockedSession = null;
    state.lockedLeaderboard = [];
  }

  function buildSimulationSnapshot() {
    const session =
      state.simulation.sessionId && state.activeSessionId === state.simulation.sessionId
        ? state.sessions.find((item) => item.id === state.simulation.sessionId) || null
        : null;
    const hasReadySession = Boolean(state.activeSessionId && state.raceState !== RACE_STATES.LOCKED);
    const status = state.simulation.active
      ? SIMULATION_STATUSES.ACTIVE
      : state.simulation.status === SIMULATION_STATUSES.COMPLETED
        ? SIMULATION_STATUSES.COMPLETED
        : hasReadySession
          ? SIMULATION_STATUSES.READY
          : SIMULATION_STATUSES.IDLE;

    return {
      status,
      active: state.simulation.active,
      sessionId: state.simulation.sessionId,
      startedAtMs: state.simulation.startedAtMs,
      endedAtMs: state.simulation.endedAtMs,
      maxDurationMs: state.simulation.maxDurationMs,
      targetLapCount: state.simulation.targetLapCount,
      hardCapReached: state.simulation.hardCapReached,
      completionReason: state.simulation.completionReason,
      racers: state.simulation.racers.map((meta) => {
        const racer = session?.racers.find((item) => item.id === meta.racerId) || null;
        const targetDuration = Number.isFinite(meta.targetLapDurationMs)
          ? meta.targetLapDurationMs
          : 1;
        const progress = meta.targetCompleted
          ? 1
          : clamp(meta.lapProgressMs / targetDuration, 0, 0.999);
        return {
          racerId: meta.racerId,
          progress,
          lapIndex: meta.lapIndex,
          targetLapDurationMs: meta.targetLapDurationMs,
          lapProgressMs: meta.lapProgressMs,
          targetCompleted: Boolean(meta.targetCompleted),
          finishPlace: Number.isFinite(racer?.finishPlace) ? racer.finishPlace : null,
        };
      }),
    };
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

  function ensureSimulationReady(code = "SIMULATION_BLOCKED") {
    ensure(
      state.raceState === RACE_STATES.STAGING,
      code,
      "Simulation can only start from STAGING.",
      409
    );
    const activeSession = getActiveSession(code);
    ensure(
      activeSession.racers.length > 0,
      code,
      "Simulation requires at least one staged racer.",
      409
    );
    ensure(!state.simulation.active, code, "Simulation is already active.", 409);
    return activeSession;
  }

  function clearSimulation({ preserveCompletion = false } = {}) {
    const nextState = createSimulationState();
    if (preserveCompletion) {
      nextState.status = SIMULATION_STATUSES.COMPLETED;
      nextState.active = false;
      nextState.seed = state.simulation.seed;
      nextState.sessionId = state.simulation.sessionId;
      nextState.startedAtMs = state.simulation.startedAtMs;
      nextState.endedAtMs = state.simulation.endedAtMs;
      nextState.maxDurationMs = state.simulation.maxDurationMs;
      nextState.targetLapCount = state.simulation.targetLapCount;
      nextState.hardCapReached = state.simulation.hardCapReached;
      nextState.completionReason = state.simulation.completionReason;
    }
    state.simulation = nextState;
  }

  function simulationLapDuration(meta, lapIndex) {
    const jitterSeed = meta.seed + lapIndex * 101;
    const jitter = (seededUnit(jitterSeed) - 0.5) * 2 * meta.jitterMs;
    const staminaShift = ((lapIndex - 1) * 0.015) * meta.baselineLapMs * (1 - meta.consistencyFactor);
    return Math.max(
      simConfig.minLapDurationMs,
      Math.round(meta.baselineLapMs + jitter + staminaShift)
    );
  }

  function prepareSimulationFinishQueue({ nowMs, racerIds = [] }) {
    const queue = racerIds.filter((racerId) => {
      const racer = getActiveSession().racers.find((item) => item.id === racerId);
      return racer && !Number.isFinite(racer.finishPlace);
    });
    state.simulation.finishQueue = queue;
    state.simulation.finishQueueNextAtMs = queue.length > 0 ? nowMs + simConfig.drainIntervalMs : null;
  }

  function completeSimulation({ reason, endedAtMs = now(), hardCapReached = false }) {
    state.simulation.active = false;
    state.simulation.status = SIMULATION_STATUSES.COMPLETED;
    state.simulation.endedAtMs = endedAtMs;
    state.simulation.completionReason = reason;
    state.simulation.hardCapReached = hardCapReached;
    state.simulation.finishQueue = [];
    state.simulation.finishQueueNextAtMs = null;
    state.simulation.racers = state.simulation.racers.map((meta) => ({
      ...meta,
      lapProgressMs: meta.targetCompleted
        ? meta.targetLapDurationMs || meta.lapProgressMs
        : meta.lapProgressMs,
      lastAdvancedAtMs: endedAtMs,
    }));
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
    resetLockedPresentation();
    clearSimulation();

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

    if (state.simulation.sessionId === sessionId) {
      clearSimulation();
    }

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

  function ensureUniqueCarNumber(session, carNumber, excludeRacerId = null) {
    const normalizedCarNumber = normalizeOptionalString(carNumber);
    if (!normalizedCarNumber) {
      return;
    }

    const duplicate = session.racers.find((racer) => {
      if (excludeRacerId && racer.id === excludeRacerId) {
        return false;
      }

      return normalizeOptionalString(racer.carNumber)?.toLowerCase() === normalizedCarNumber.toLowerCase();
    });

    ensure(
      !duplicate,
      "DUPLICATE_CAR_NUMBER",
      `Car ${normalizedCarNumber} is already assigned to ${duplicate?.name || "another racer"} in this session.`,
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
    ensureUniqueCarNumber(session, carNumber);

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
      ensureUniqueCarNumber(session, carNumber, racerId);
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
    clearSimulation();
    state.raceMode = RACE_MODES.SAFE;
    state.remainingSeconds = raceDurationSeconds;
    state.timerEndsAt = null;
    resetLockedPresentation();
    transitionTo(RACE_STATES.RUNNING, "START_BLOCKED");
    syncFlagFromState();

    return clone(activeSession);
  }

  function startSimulation({
    seed = now(),
    startedAtMs = now(),
    maxDurationMs = simConfig.maxDurationMs,
    targetLapCount = simConfig.targetLapCount,
  } = {}) {
    const activeSession = ensureSimulationReady("SIMULATION_START_BLOCKED");
    startRace();

    state.simulation = {
      status: SIMULATION_STATUSES.ACTIVE,
      active: true,
      seed,
      sessionId: activeSession.id,
      startedAtMs,
      endedAtMs: null,
      maxDurationMs,
      targetLapCount,
      hardCapReached: false,
      completionReason: null,
      finishQueue: [],
      finishQueueNextAtMs: null,
      racerOrder: [],
      racers: activeSession.racers.map((racer, index) => {
        const racerSeed = hashString(`${seed}:${racer.id}:${racer.carNumber || racer.name}:${index}`);
        const baselineLapMs = Math.round(
          simConfig.baselineLapMsMin +
            seededUnit(racerSeed) * (simConfig.baselineLapMsMax - simConfig.baselineLapMsMin)
        );
        const jitterMs = Math.round(
          simConfig.jitterMsMin +
            seededUnit(racerSeed + 1) * (simConfig.jitterMsMax - simConfig.jitterMsMin)
        );
        const consistencyFactor = 0.84 + seededUnit(racerSeed + 2) * 0.16;
        const lapIndex = 1;
        const targetLapDurationMs = simulationLapDuration(
          {
            seed: racerSeed,
            baselineLapMs,
            jitterMs,
            consistencyFactor,
          },
          lapIndex
        );

        return {
          racerId: racer.id,
          seed: racerSeed,
          baselineLapMs,
          jitterMs,
          consistencyFactor,
          lapIndex,
          targetLapDurationMs,
          lapProgressMs: 0,
          lastAdvancedAtMs: startedAtMs,
          targetCompleted: false,
          targetCompletedAtMs: null,
        };
      }),
    };

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

    if (state.simulation.active) {
      const orderedRacerIds =
        reason === "simulation_target_laps" && state.simulation.racerOrder.length > 0
          ? state.simulation.racerOrder
          : buildLeaderboard().map((entry) => entry.racerId);
      prepareSimulationFinishQueue({ nowMs: now(), racerIds: orderedRacerIds });
    }

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
    clearSimulation();

    return clone(activeSession);
  }

  function recordLapCrossing({ racerId, timestampMs = now(), source = "manual" }) {
    ensure(
      canAcceptLapInput(state.raceState),
      "LAP_INPUT_BLOCKED",
      "Lap input is only allowed while RUNNING or FINISHED.",
      409
    );
    ensure(
      !state.simulation.active || source === "simulation",
      "LAP_INPUT_BLOCKED",
      "Manual lap input is blocked while simulation is active.",
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

  function advanceSimulation({ nowMs = now() } = {}) {
    if (!state.simulation.active) {
      return { active: false, changed: false, shouldPersist: false };
    }

    let changed = false;
    let shouldPersist = false;

    if (state.simulation.startedAtMs !== null) {
      const elapsedMs = nowMs - state.simulation.startedAtMs;
      if (elapsedMs >= state.simulation.maxDurationMs) {
        if (state.raceState === RACE_STATES.RUNNING) {
          finishRace({ reason: "simulation_time_cap" });
          changed = true;
          shouldPersist = true;
        }
        completeSimulation({
          reason: "hard_cap",
          endedAtMs: nowMs,
          hardCapReached: true,
        });
        return { active: false, changed: true, shouldPersist: true, hardCapReached: true };
      }
    }

    if (state.raceState === RACE_STATES.RUNNING) {
      const modeFactor =
        state.raceMode === RACE_MODES.HAZARD_STOP
          ? 0
          : state.raceMode === RACE_MODES.HAZARD_SLOW
            ? simConfig.hazardSlowFactor
            : 1;

      for (const meta of state.simulation.racers) {
        if (meta.targetCompleted) {
          meta.lastAdvancedAtMs = nowMs;
          continue;
        }

        const deltaMs = Math.max(0, nowMs - (meta.lastAdvancedAtMs ?? nowMs));
        meta.lastAdvancedAtMs = nowMs;
        meta.lapProgressMs += deltaMs * modeFactor;
        changed = changed || deltaMs > 0;

        while (!meta.targetCompleted && meta.lapProgressMs >= meta.targetLapDurationMs) {
          meta.lapProgressMs -= meta.targetLapDurationMs;
          recordLapCrossing({ racerId: meta.racerId, timestampMs: nowMs, source: "simulation" });
          shouldPersist = true;
          changed = true;
          const racer = getActiveSession().racers.find((item) => item.id === meta.racerId);
          if (racer && racer.lapCount >= state.simulation.targetLapCount) {
            meta.targetCompleted = true;
            meta.targetCompletedAtMs = nowMs;
            meta.lapProgressMs = meta.targetLapDurationMs;
            if (!state.simulation.racerOrder.includes(meta.racerId)) {
              state.simulation.racerOrder.push(meta.racerId);
            }
            break;
          }
          meta.lapIndex += 1;
          meta.targetLapDurationMs = simulationLapDuration(meta, meta.lapIndex);
        }
      }

      const everyoneComplete =
        state.simulation.racers.length > 0 &&
        state.simulation.racers.every((meta) => meta.targetCompleted);
      if (everyoneComplete) {
        finishRace({ reason: "simulation_target_laps" });
        changed = true;
        shouldPersist = true;
      }
    }

    if (state.raceState === RACE_STATES.FINISHED && state.simulation.active) {
      if (
        state.simulation.finishQueue.length > 0 &&
        state.simulation.finishQueueNextAtMs !== null &&
        nowMs >= state.simulation.finishQueueNextAtMs
      ) {
        const racerId = state.simulation.finishQueue.shift();
        if (racerId) {
          recordLapCrossing({ racerId, timestampMs: nowMs, source: "simulation" });
          changed = true;
          shouldPersist = true;
        }
        state.simulation.finishQueueNextAtMs =
          state.simulation.finishQueue.length > 0 ? nowMs + simConfig.drainIntervalMs : null;
      }

      if (state.simulation.finishQueue.length === 0) {
        completeSimulation({ reason: "auto_checkered", endedAtMs: nowMs });
        changed = true;
        shouldPersist = true;
      }
    }

    if (state.raceState === RACE_STATES.LOCKED && state.simulation.active) {
      completeSimulation({ reason: "manual_lock", endedAtMs: nowMs });
      changed = true;
      shouldPersist = true;
    }

    return {
      active: state.simulation.active,
      changed,
      shouldPersist,
      hardCapReached: false,
    };
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
      simulation: buildSimulationSnapshot(),
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
    startSimulation,
    startRace,
    advanceSimulation,
    syncTimer,
    updateRacer,
    updateSession,
  };
}

module.exports = {
  DomainError,
  createRaceStore,
};
