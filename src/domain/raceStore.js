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
  targetLapCount: 5,
  baselineLapMsMin: 20_800,
  baselineLapMsMax: 24_200,
  jitterMsMin: 220,
  jitterMsMax: 420,
  minLapDurationMs: 6_000,
  drainIntervalMs: 650,
  hazardSlowFactor: 0.45,
  pitLaunchDurationMsMin: 2_600,
  pitLaunchDurationMsMax: 3_800,
  pitLaunchReleaseGapMs: 420,
  pitReturnDurationMsMin: 6_000,
  pitReturnDurationMsMax: 9_200,
  pitReturnReleaseGapMs: 650,
});

const AUTHORITATIVE_CAR_POOL = Object.freeze(
  Array.from({ length: 8 }, (_unused, index) => String(index + 1))
);

const SIMULATION_STATUSES = Object.freeze({
  IDLE: "IDLE",
  READY: "READY",
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
});

const SIMULATION_PHASES = Object.freeze({
  IDLE: "IDLE",
  READY: "READY",
  SAFE_RUN: "SAFE_RUN",
  HAZARD_SLOW: "HAZARD_SLOW",
  HAZARD_STOP: "HAZARD_STOP",
  RECOVERY: "RECOVERY",
  CHECKERED: "CHECKERED",
  PIT_RETURN: "PIT_RETURN",
  COMPLETED: "COMPLETED",
});

const SIMULATION_LANES = Object.freeze({
  TRACK: "TRACK",
  PIT: "PIT",
  GARAGE: "GARAGE",
});

const PIT_EXIT_TRACK_START_PROGRESS = 0.82;
const PIT_EXIT_TRACK_SPAN = 0.18;

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
    phase: SIMULATION_PHASES.IDLE,
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
    scenarioPlan: [],
    pitReturnStartedAtMs: null,
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
    carNumber: normalizeOptionalString(racer?.carNumber),
    seed: Number.isFinite(racer?.seed) ? racer.seed : null,
    baselineLapMs: Number.isFinite(racer?.baselineLapMs) ? racer.baselineLapMs : null,
    jitterMs: Number.isFinite(racer?.jitterMs) ? racer.jitterMs : null,
    consistencyFactor: Number.isFinite(racer?.consistencyFactor)
      ? racer.consistencyFactor
      : 1,
    lapIndex: Number.isFinite(racer?.lapIndex) ? racer.lapIndex : 0,
    targetLapDurationMs: Number.isFinite(racer?.targetLapDurationMs)
      ? racer.targetLapDurationMs
      : null,
    lapProgressMs: Number.isFinite(racer?.lapProgressMs) ? racer.lapProgressMs : 0,
    lastAdvancedAtMs: Number.isFinite(racer?.lastAdvancedAtMs) ? racer.lastAdvancedAtMs : null,
    timedLapStarted: Boolean(racer?.timedLapStarted),
    crossingCount: Number.isFinite(racer?.crossingCount) ? racer.crossingCount : 0,
    targetCompleted: Boolean(racer?.targetCompleted),
    targetCompletedAtMs: Number.isFinite(racer?.targetCompletedAtMs)
      ? racer.targetCompletedAtMs
      : null,
    lane: Object.values(SIMULATION_LANES).includes(racer?.lane)
      ? racer.lane
      : SIMULATION_LANES.TRACK,
    pitProgressMs: Number.isFinite(racer?.pitProgressMs) ? racer.pitProgressMs : 0,
    pitDurationMs: Number.isFinite(racer?.pitDurationMs) ? racer.pitDurationMs : null,
    pitReleaseAtMs: Number.isFinite(racer?.pitReleaseAtMs) ? racer.pitReleaseAtMs : null,
    pitCompletedAtMs: Number.isFinite(racer?.pitCompletedAtMs) ? racer.pitCompletedAtMs : null,
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
    phase: Object.values(SIMULATION_PHASES).includes(simulation?.phase)
      ? simulation.phase
      : simulation?.active
        ? SIMULATION_PHASES.SAFE_RUN
        : simulation?.status === SIMULATION_STATUSES.COMPLETED
          ? SIMULATION_PHASES.COMPLETED
          : SIMULATION_PHASES.IDLE,
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
    scenarioPlan: Array.isArray(simulation?.scenarioPlan)
      ? simulation.scenarioPlan
          .map((entry) => ({
            phase: Object.values(SIMULATION_PHASES).includes(entry?.phase)
              ? entry.phase
              : SIMULATION_PHASES.SAFE_RUN,
            mode: Object.values(RACE_MODES).includes(entry?.mode) ? entry.mode : RACE_MODES.SAFE,
            startsAtMs: Number.isFinite(entry?.startsAtMs) ? entry.startsAtMs : null,
            endsAtMs: Number.isFinite(entry?.endsAtMs) ? entry.endsAtMs : null,
            trigger: typeof entry?.trigger === "string" ? entry.trigger : "time_window",
          }))
          .filter((entry) => Number.isFinite(entry.startsAtMs) || entry.trigger !== "time_window")
      : [],
    pitReturnStartedAtMs: Number.isFinite(simulation?.pitReturnStartedAtMs)
      ? simulation.pitReturnStartedAtMs
      : null,
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
  manualCarAssignmentEnabled = false,
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

  function getAssignedCarNumbers(session, excludeRacerId = null) {
    return new Set(
      session.racers
        .filter((racer) => !(excludeRacerId && racer.id === excludeRacerId))
        .map((racer) => normalizeOptionalString(racer.carNumber))
        .filter((value) => value !== null)
    );
  }

  function getAvailableCarNumbers(session, excludeRacerId = null) {
    const assigned = getAssignedCarNumbers(session, excludeRacerId);
    return AUTHORITATIVE_CAR_POOL.filter((carNumber) => !assigned.has(carNumber));
  }

  function normalizeSessionAssignments(session) {
    const available = AUTHORITATIVE_CAR_POOL.slice();
    const remainingRacers = [];

    for (const racer of session.racers) {
      const normalizedCarNumber = normalizeOptionalString(racer.carNumber);
      if (normalizedCarNumber && available.includes(normalizedCarNumber)) {
        racer.carNumber = normalizedCarNumber;
        available.splice(available.indexOf(normalizedCarNumber), 1);
      } else {
        remainingRacers.push(racer);
      }
    }

    for (const racer of remainingRacers) {
      racer.carNumber = available.shift() || null;
    }
  }

  function buildSimulationSnapshot() {
    const session = state.simulation.sessionId
      ? (
          state.sessions.find((item) => item.id === state.simulation.sessionId) ||
          (state.lockedSession?.id === state.simulation.sessionId ? state.lockedSession : null)
        )
      : null;
    const hasReadySession = Boolean(state.activeSessionId && state.raceState !== RACE_STATES.LOCKED);
    const status = state.simulation.active
      ? SIMULATION_STATUSES.ACTIVE
      : state.simulation.status === SIMULATION_STATUSES.COMPLETED
        ? SIMULATION_STATUSES.COMPLETED
        : hasReadySession
          ? SIMULATION_STATUSES.READY
          : SIMULATION_STATUSES.IDLE;
    const phase =
      status === SIMULATION_STATUSES.COMPLETED
        ? SIMULATION_PHASES.COMPLETED
        : status === SIMULATION_STATUSES.ACTIVE
          ? state.simulation.phase
          : status === SIMULATION_STATUSES.READY
            ? SIMULATION_PHASES.READY
            : SIMULATION_PHASES.IDLE;

    return {
      status,
      active: state.simulation.active,
      phase,
      sessionId: state.simulation.sessionId,
      startedAtMs: state.simulation.startedAtMs,
      endedAtMs: state.simulation.endedAtMs,
      maxDurationMs: state.simulation.maxDurationMs,
      targetLapCount: state.simulation.targetLapCount,
      hardCapReached: state.simulation.hardCapReached,
      completionReason: state.simulation.completionReason,
      racers: state.simulation.racers.map((meta) => {
        const racer = session?.racers.find((item) => item.id === meta.racerId) || null;
        const progress = meta.lane === SIMULATION_LANES.TRACK
          ? resolveSimulationTrackProgress(meta)
          : 0;
        const pitDuration = Number.isFinite(meta.pitDurationMs) ? meta.pitDurationMs : 1;
        const pitProgress = meta.lane === SIMULATION_LANES.GARAGE
          ? 1
          : clamp(meta.pitProgressMs / pitDuration, 0, 0.999);
        return {
          racerId: meta.racerId,
          carNumber: racer?.carNumber || meta.carNumber || null,
          progress,
          lane: meta.lane,
          pitProgress,
          lapIndex: meta.lapIndex,
          targetLapDurationMs: meta.targetLapDurationMs,
          lapProgressMs: meta.lapProgressMs,
          timedLapStarted: Boolean(meta.timedLapStarted),
          crossingCount: Number.isFinite(meta.crossingCount)
            ? meta.crossingCount
            : racer?.lapCount || 0,
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

  if (!manualCarAssignmentEnabled) {
    state.sessions.forEach(normalizeSessionAssignments);
    if (state.lockedSession) {
      normalizeSessionAssignments(state.lockedSession);
    }
  }

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
      nextState.phase = SIMULATION_PHASES.COMPLETED;
      nextState.seed = state.simulation.seed;
      nextState.sessionId = state.simulation.sessionId;
      nextState.startedAtMs = state.simulation.startedAtMs;
      nextState.endedAtMs = state.simulation.endedAtMs;
      nextState.maxDurationMs = state.simulation.maxDurationMs;
      nextState.targetLapCount = state.simulation.targetLapCount;
      nextState.hardCapReached = state.simulation.hardCapReached;
      nextState.completionReason = state.simulation.completionReason;
      nextState.scenarioPlan = clone(state.simulation.scenarioPlan || []);
      nextState.racers = clone(state.simulation.racers || []);
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

  function simulationPitLaunchDuration(meta) {
    return Math.max(
      20,
      Math.round(
        simConfig.pitLaunchDurationMsMin +
          seededUnit(meta.seed + 17) *
            (simConfig.pitLaunchDurationMsMax - simConfig.pitLaunchDurationMsMin)
      )
    );
  }

  function simulationPrestartDuration(meta) {
    return Math.max(
      40,
      Math.round(meta.baselineLapMs * (0.18 + seededUnit(meta.seed + 19) * 0.06))
    );
  }

  function resolveSimulationTrackProgress(meta) {
    const targetDuration = Math.max(1, meta.targetLapDurationMs || 1);
    const segmentProgress = clamp(meta.lapProgressMs / targetDuration, 0, 0.999);
    if (!meta.timedLapStarted) {
      return clamp(
        PIT_EXIT_TRACK_START_PROGRESS + segmentProgress * PIT_EXIT_TRACK_SPAN,
        PIT_EXIT_TRACK_START_PROGRESS,
        0.999
      );
    }

    return segmentProgress;
  }

  function buildSimulationScenarioPlan({ seed, startedAtMs, targetLapCount, racers }) {
    const averageLapDurationMs = Math.max(
      simConfig.minLapDurationMs,
      Math.round(
        racers.reduce(
          (sum, racer) =>
            sum +
            simulationLapDuration(
              {
                ...racer,
                lapIndex: 1,
              },
              1
            ),
          0
        ) /
          Math.max(racers.length, 1)
      )
    );
    const projectedRunMs = Math.max(
      averageLapDurationMs * Math.max(targetLapCount, 1),
      averageLapDurationMs * 2
    );
    const hazardStartAtMs = startedAtMs + Math.round(
      projectedRunMs * (0.28 + seededUnit(seed + 41) * 0.12)
    );
    const hazardSlowDurationMs = Math.max(
      900,
      Math.round(averageLapDurationMs * (0.18 + seededUnit(seed + 43) * 0.08))
    );
    const includeStop = seededUnit(seed + 47) >= 0.42;
    const hazardStopDurationMs = includeStop
      ? Math.max(500, Math.round(averageLapDurationMs * (0.08 + seededUnit(seed + 53) * 0.05)))
      : 0;
    const hazardSlowEndsAtMs = hazardStartAtMs + hazardSlowDurationMs;
    const hazardStopEndsAtMs = hazardSlowEndsAtMs + hazardStopDurationMs;
    const recoveryStartsAtMs = includeStop ? hazardStopEndsAtMs : hazardSlowEndsAtMs;

    return [
      {
        phase: SIMULATION_PHASES.SAFE_RUN,
        mode: RACE_MODES.SAFE,
        startsAtMs: startedAtMs,
        endsAtMs: hazardStartAtMs,
        trigger: "time_window",
      },
      {
        phase: SIMULATION_PHASES.HAZARD_SLOW,
        mode: RACE_MODES.HAZARD_SLOW,
        startsAtMs: hazardStartAtMs,
        endsAtMs: hazardSlowEndsAtMs,
        trigger: "time_window",
      },
      ...(includeStop
        ? [
            {
              phase: SIMULATION_PHASES.HAZARD_STOP,
              mode: RACE_MODES.HAZARD_STOP,
              startsAtMs: hazardSlowEndsAtMs,
              endsAtMs: hazardStopEndsAtMs,
              trigger: "time_window",
            },
          ]
        : []),
      {
        phase: SIMULATION_PHASES.RECOVERY,
        mode: RACE_MODES.SAFE,
        startsAtMs: recoveryStartsAtMs,
        endsAtMs: null,
        trigger: "time_window",
      },
      {
        phase: SIMULATION_PHASES.CHECKERED,
        mode: RACE_MODES.SAFE,
        startsAtMs: null,
        endsAtMs: null,
        trigger: "target_laps_reached",
      },
      {
        phase: SIMULATION_PHASES.PIT_RETURN,
        mode: RACE_MODES.SAFE,
        startsAtMs: null,
        endsAtMs: null,
        trigger: "pit_return",
      },
      {
        phase: SIMULATION_PHASES.COMPLETED,
        mode: RACE_MODES.SAFE,
        startsAtMs: null,
        endsAtMs: null,
        trigger: "pit_return_complete",
      },
    ];
  }

  function resolveTimedScenarioPhase(nowMs) {
    const timedPhase = state.simulation.scenarioPlan.find((entry) => {
      if (entry.trigger !== "time_window" || !Number.isFinite(entry.startsAtMs)) {
        return false;
      }

      return nowMs >= entry.startsAtMs && (entry.endsAtMs === null || nowMs < entry.endsAtMs);
    });

    return timedPhase || null;
  }

  function applySimulationScenarioPhase(nextPhase, nextMode) {
    if (state.simulation.phase === nextPhase) {
      return false;
    }

    state.simulation.phase = nextPhase;
    if (Object.values(RACE_MODES).includes(nextMode)) {
      state.raceMode = nextMode;
      syncFlagFromState();
    }
    return true;
  }

  function startPitReturn(nowMs) {
    const orderedRacerIds =
      state.simulation.racerOrder.length > 0
        ? state.simulation.racerOrder
        : buildLeaderboard().map((entry) => entry.racerId);

    state.simulation.phase = SIMULATION_PHASES.PIT_RETURN;
    state.simulation.pitReturnStartedAtMs = nowMs;
    state.simulation.racers = state.simulation.racers.map((meta) => {
      const pitIndex = Math.max(0, orderedRacerIds.indexOf(meta.racerId));
      const pitDurationMs = Math.max(
        500,
        Math.round(
          simConfig.pitReturnDurationMsMin +
            seededUnit(meta.seed + 211) *
              (simConfig.pitReturnDurationMsMax - simConfig.pitReturnDurationMsMin)
        )
      );
      return {
        ...meta,
        lane: SIMULATION_LANES.TRACK,
        pitProgressMs: 0,
        pitDurationMs,
        pitReleaseAtMs: nowMs + pitIndex * simConfig.pitReturnReleaseGapMs,
        pitCompletedAtMs: null,
        lastAdvancedAtMs: nowMs,
      };
    });
  }

  function completeSimulation({ reason, endedAtMs = now(), hardCapReached = false }) {
    state.simulation.active = false;
    state.simulation.status = SIMULATION_STATUSES.COMPLETED;
    state.simulation.phase = SIMULATION_PHASES.COMPLETED;
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
      pitProgressMs: Number.isFinite(meta.pitDurationMs)
        ? Math.min(meta.pitProgressMs, meta.pitDurationMs)
        : meta.pitProgressMs,
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

  function ensureCarPoolCapacity(session, excludeRacerId = null) {
    const availableCars = getAvailableCarNumbers(session, excludeRacerId);
    ensure(
      availableCars.length > 0,
      "SESSION_CAR_POOL_EXHAUSTED",
      "All 8 authoritative cars are already assigned in this session.",
      409
    );
    return availableCars;
  }

  function validateManualCarNumber(carNumber) {
    const normalizedCarNumber = normalizeOptionalString(carNumber);
    if (!normalizedCarNumber) {
      return null;
    }

    ensure(
      AUTHORITATIVE_CAR_POOL.includes(normalizedCarNumber),
      "INVALID_CAR_NUMBER",
      `Car ${normalizedCarNumber} is not in the authoritative 1-8 car pool.`,
      409
    );

    return normalizedCarNumber;
  }

  function addRacer(sessionId, { name, carNumber }) {
    const session = getSession(sessionId);
    assertSessionMutationAllowed(
      sessionId,
      "SESSION_EDIT_FORBIDDEN",
      "Current session cannot be edited while the race is running or finished."
    );
    ensureUniqueRacerName(session, name);
    const resolvedCarNumber = manualCarAssignmentEnabled
      ? validateManualCarNumber(carNumber)
      : ensureCarPoolCapacity(session)[0];
    ensureUniqueCarNumber(session, resolvedCarNumber);

    const racer = {
      id: `racer-${state.nextRacerId++}`,
      name: name.trim(),
      carNumber: resolvedCarNumber,
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
      if (manualCarAssignmentEnabled) {
        const normalizedCarNumber = validateManualCarNumber(carNumber);
        ensureUniqueCarNumber(session, normalizedCarNumber, racerId);
        racer.carNumber = normalizedCarNumber;
      }
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

  function assignFinishPlace(session, racer, timestampMs) {
    if (Number.isFinite(racer.finishPlace)) {
      return;
    }

    racer.finishPlace = getRecordedFinishCount(session) + 1;
    racer.finishRecordedAtMs = timestampMs;
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
    return entries.slice().sort(sortCompetitiveEntries);
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
    resetLockedPresentation();
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
      phase: SIMULATION_PHASES.SAFE_RUN,
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
      scenarioPlan: [],
      pitReturnStartedAtMs: null,
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
        const targetLapDurationMs = simulationPrestartDuration(
          {
            seed: racerSeed,
            baselineLapMs,
            jitterMs,
            consistencyFactor,
          }
        );
        const pitDurationMs = simulationPitLaunchDuration({
          seed: racerSeed,
          baselineLapMs,
        });

        return {
          racerId: racer.id,
          carNumber: racer.carNumber,
          seed: racerSeed,
          baselineLapMs,
          jitterMs,
          consistencyFactor,
          lapIndex: 0,
          targetLapDurationMs,
          lapProgressMs: 0,
          lastAdvancedAtMs: startedAtMs,
          timedLapStarted: false,
          crossingCount: 0,
          targetCompleted: false,
          targetCompletedAtMs: null,
          lane: SIMULATION_LANES.PIT,
          pitProgressMs: 0,
          pitDurationMs,
          pitReleaseAtMs: startedAtMs + index * simConfig.pitLaunchReleaseGapMs,
          pitCompletedAtMs: null,
        };
      }),
    };
    state.simulation.scenarioPlan = buildSimulationScenarioPlan({
      seed,
      startedAtMs,
      targetLapCount,
      racers: state.simulation.racers,
    });
    state.raceMode = RACE_MODES.SAFE;
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

    if (state.simulation.active) {
      state.simulation.phase = SIMULATION_PHASES.CHECKERED;
      state.simulation.finishQueue = [];
      state.simulation.finishQueueNextAtMs = null;
    }

    return { reason };
  }

  function lockRace({ preserveSimulationCompletion = false } = {}) {
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
    state.activeSessionId = state.sessions[0]?.id || null;
    resetRaceClock();
    if (state.activeSessionId) {
      transitionTo(RACE_STATES.STAGING, "LOCK_BLOCKED");
      state.raceMode = RACE_MODES.SAFE;
    } else {
      state.raceMode = RACE_MODES.HAZARD_STOP;
    }
    syncFlagFromState();
    clearSimulation({ preserveCompletion: preserveSimulationCompletion });

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
    if (state.raceState === RACE_STATES.FINISHED) {
      assignFinishPlace(activeSession, racer, timestampMs);
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
      const timedPhase = resolveTimedScenarioPhase(nowMs);
      if (timedPhase && applySimulationScenarioPhase(timedPhase.phase, timedPhase.mode)) {
        changed = true;
        shouldPersist = true;
      }

      const modeFactor =
        state.raceMode === RACE_MODES.HAZARD_STOP
          ? 0
          : state.raceMode === RACE_MODES.HAZARD_SLOW
            ? simConfig.hazardSlowFactor
            : 1;
      let finishTriggered = false;

      for (const meta of state.simulation.racers) {
        const deltaMs = Math.max(0, nowMs - (meta.lastAdvancedAtMs ?? nowMs));
        meta.lastAdvancedAtMs = nowMs;
        if (meta.targetCompleted) {
          continue;
        }

        if (meta.lane === SIMULATION_LANES.PIT) {
          if (meta.pitReleaseAtMs !== null && nowMs < meta.pitReleaseAtMs) {
            continue;
          }

          meta.pitProgressMs += deltaMs * modeFactor;
          changed = changed || deltaMs > 0;

          if (meta.pitProgressMs >= meta.pitDurationMs) {
            meta.pitProgressMs = meta.pitDurationMs;
            meta.pitCompletedAtMs = nowMs;
            meta.lane = SIMULATION_LANES.TRACK;
            meta.lapProgressMs = 0;
          }
          continue;
        }

        meta.lapProgressMs += deltaMs * modeFactor;
        changed = changed || deltaMs > 0;

        while (!meta.targetCompleted && meta.lapProgressMs >= meta.targetLapDurationMs) {
          meta.lapProgressMs -= meta.targetLapDurationMs;
          const racer = recordLapCrossing({
            racerId: meta.racerId,
            timestampMs: nowMs,
            source: "simulation",
          });
          meta.crossingCount = racer.lapCount;
          shouldPersist = true;
          changed = true;

          if (!meta.timedLapStarted) {
            meta.timedLapStarted = true;
            meta.lapIndex = 1;
            meta.targetLapDurationMs = simulationLapDuration(meta, meta.lapIndex);
            meta.lapProgressMs = 0;
            continue;
          }

          if (racer && racer.lapCount >= state.simulation.targetLapCount) {
            meta.targetCompleted = true;
            meta.targetCompletedAtMs = nowMs;
            meta.lapProgressMs = 0;
            if (!state.simulation.racerOrder.includes(meta.racerId)) {
              state.simulation.racerOrder.push(meta.racerId);
            }
            finishRace({ reason: "simulation_target_laps" });
            assignFinishPlace(getActiveSession(), racer, nowMs);
            finishTriggered = true;
            break;
          }
          meta.lapIndex += 1;
          meta.targetLapDurationMs = simulationLapDuration(meta, meta.lapIndex);
        }

        if (finishTriggered) {
          break;
        }
      }

      if (finishTriggered) {
        changed = true;
        shouldPersist = true;
      }
    }

    if (state.raceState === RACE_STATES.FINISHED && state.simulation.active) {
      if (state.simulation.phase === SIMULATION_PHASES.CHECKERED) {
        for (const meta of state.simulation.racers) {
          const racer = getActiveSession().racers.find((item) => item.id === meta.racerId);
          if (!racer || Number.isFinite(racer.finishPlace) || meta.lane !== SIMULATION_LANES.TRACK) {
            meta.lastAdvancedAtMs = nowMs;
            continue;
          }

          const deltaMs = Math.max(0, nowMs - (meta.lastAdvancedAtMs ?? nowMs));
          meta.lastAdvancedAtMs = nowMs;
          meta.lapProgressMs += deltaMs;
          changed = changed || deltaMs > 0;

          while (meta.lapProgressMs >= meta.targetLapDurationMs && !Number.isFinite(racer.finishPlace)) {
            meta.lapProgressMs -= meta.targetLapDurationMs;
            const updatedRacer = recordLapCrossing({
              racerId: meta.racerId,
              timestampMs: nowMs,
              source: "simulation",
            });
            meta.crossingCount = updatedRacer.lapCount;
            meta.targetCompleted = true;
            meta.targetCompletedAtMs = nowMs;
            meta.lapProgressMs = 0;
            if (!state.simulation.racerOrder.includes(meta.racerId)) {
              state.simulation.racerOrder.push(meta.racerId);
            }
            changed = true;
            shouldPersist = true;
          }
        }

        const everyoneFinished = getActiveSession().racers.every((racer) =>
          Number.isFinite(racer.finishPlace)
        );
        if (everyoneFinished) {
          startPitReturn(nowMs);
          changed = true;
          shouldPersist = true;
        }
      } else if (state.simulation.phase === SIMULATION_PHASES.PIT_RETURN) {
        for (const meta of state.simulation.racers) {
          if (meta.pitCompletedAtMs !== null) {
            continue;
          }

          const deltaMs = Math.max(0, nowMs - (meta.lastAdvancedAtMs ?? nowMs));
          meta.lastAdvancedAtMs = nowMs;

          if (meta.pitReleaseAtMs !== null && nowMs < meta.pitReleaseAtMs) {
            meta.lane = SIMULATION_LANES.TRACK;
            continue;
          }

          meta.lane = SIMULATION_LANES.PIT;
          meta.pitProgressMs += deltaMs;

          if (meta.pitProgressMs >= meta.pitDurationMs) {
            meta.pitProgressMs = meta.pitDurationMs;
            meta.pitCompletedAtMs = nowMs;
            meta.lane = SIMULATION_LANES.GARAGE;
          }
          changed = changed || deltaMs > 0;
        }

        const allReturned = state.simulation.racers.every(
          (meta) => meta.pitCompletedAtMs !== null
        );
        if (allReturned) {
          completeSimulation({ reason: "pit_return_complete", endedAtMs: nowMs });
          lockRace({ preserveSimulationCompletion: true });
          changed = true;
          shouldPersist = true;
          return { active: false, changed: true, shouldPersist: true, hardCapReached: false };
        }
      } else {
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
        position: index + 1,
        ...entry,
      }));
  }

  function getSnapshot() {
    const activeSession = state.activeSessionId
      ? state.sessions.find((session) => session.id === state.activeSessionId)
      : null;
    const queueView = buildQueueView(state.sessions, state.activeSessionId);
    const heldResults =
      state.raceState === RACE_STATES.FINISHED
        ? buildLeaderboard()
        : state.lockedSession
          ? clone(state.lockedLeaderboard)
          : null;

    return {
      state: state.raceState,
      mode: state.raceMode,
      flag: state.raceFlag,
      lapEntryAllowed: canAcceptLapInput(state.raceState),
      resultsFinalized: state.raceState === RACE_STATES.LOCKED || state.lockedSession !== null,
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
        state.raceState === RACE_STATES.FINISHED ||
        state.raceState === RACE_STATES.LOCKED ||
        state.lockedSession !== null,
      simulation: buildSimulationSnapshot(),
      lockedSession: state.lockedSession ? clone(state.lockedSession) : null,
      finalResults: heldResults,
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
