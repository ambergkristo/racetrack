const fs = require("node:fs");
const path = require("node:path");
const { z } = require("zod");
const { RACE_FLAGS, RACE_MODES, RACE_STATES } = require("../domain/raceStateMachine");

const PERSISTED_STATE_VERSION = 1;

const persistedRacerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  carNumber: z.string().min(1).nullable(),
  lapCount: z.number().int().nonnegative(),
  currentLapTimeMs: z.number().int().positive().nullable(),
  bestLapTimeMs: z.number().int().positive().nullable(),
  lastCrossingTimestampMs: z.number().int().nonnegative().nullable(),
  finishPlace: z.number().int().positive().nullable().optional(),
  finishRecordedAtMs: z.number().int().nonnegative().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const persistedSessionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  racers: z.array(persistedRacerSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const persistedLeaderboardEntrySchema = z.object({
  position: z.number().int().positive(),
  racerId: z.string().min(1),
  name: z.string().min(1),
  carNumber: z.string().min(1).nullable(),
  lapCount: z.number().int().nonnegative(),
  currentLapTimeMs: z.number().int().positive().nullable(),
  bestLapTimeMs: z.number().int().positive().nullable(),
  finishPlace: z.number().int().positive().nullable().optional(),
});

const persistedSimulationRacerSchema = z.object({
  racerId: z.string().min(1),
  seed: z.number().int().nonnegative().nullable(),
  baselineLapMs: z.number().int().positive().nullable(),
  jitterMs: z.number().int().positive().nullable(),
  consistencyFactor: z.number().positive(),
  lapIndex: z.number().int().positive(),
  targetLapDurationMs: z.number().int().positive().nullable(),
  lapProgressMs: z.number().nonnegative(),
  lastAdvancedAtMs: z.number().int().nonnegative().nullable(),
  targetCompleted: z.boolean(),
  targetCompletedAtMs: z.number().int().nonnegative().nullable(),
  lane: z.enum(["TRACK", "PIT", "GARAGE"]).optional(),
  pitProgressMs: z.number().nonnegative().optional(),
  pitDurationMs: z.number().int().positive().nullable().optional(),
  pitReleaseAtMs: z.number().int().nonnegative().nullable().optional(),
  pitCompletedAtMs: z.number().int().nonnegative().nullable().optional(),
});

const persistedSimulationSchema = z.object({
  status: z.enum(["IDLE", "READY", "ACTIVE", "COMPLETED"]),
  active: z.boolean(),
  phase: z
    .enum([
      "IDLE",
      "READY",
      "SAFE_RUN",
      "HAZARD_SLOW",
      "HAZARD_STOP",
      "RECOVERY",
      "CHECKERED",
      "PIT_RETURN",
      "COMPLETED",
    ])
    .optional(),
  seed: z.number().int().nonnegative().nullable(),
  sessionId: z.string().min(1).nullable(),
  startedAtMs: z.number().int().nonnegative().nullable(),
  endedAtMs: z.number().int().nonnegative().nullable(),
  maxDurationMs: z.number().int().positive().nullable(),
  targetLapCount: z.number().int().positive().nullable(),
  hardCapReached: z.boolean(),
  completionReason: z.string().min(1).nullable(),
  finishQueue: z.array(z.string().min(1)),
  finishQueueNextAtMs: z.number().int().nonnegative().nullable(),
  racerOrder: z.array(z.string().min(1)),
  scenarioPlan: z
    .array(
      z.object({
        phase: z.enum([
          "IDLE",
          "READY",
          "SAFE_RUN",
          "HAZARD_SLOW",
          "HAZARD_STOP",
          "RECOVERY",
          "CHECKERED",
          "PIT_RETURN",
          "COMPLETED",
        ]),
        mode: z.enum(Object.values(RACE_MODES)),
        startsAtMs: z.number().int().nonnegative().nullable(),
        endsAtMs: z.number().int().nonnegative().nullable(),
        trigger: z.string().min(1),
      })
    )
    .optional(),
  pitReturnStartedAtMs: z.number().int().nonnegative().nullable().optional(),
  racers: z.array(persistedSimulationRacerSchema),
});

const persistedRaceStateSchema = z.object({
  raceState: z.enum(Object.values(RACE_STATES)),
  raceMode: z.enum(Object.values(RACE_MODES)),
  raceFlag: z.enum(Object.values(RACE_FLAGS)),
  activeSessionId: z.string().min(1).nullable(),
  sessions: z.array(persistedSessionSchema),
  remainingSeconds: z.number().int().nonnegative(),
  timerEndsAt: z.string().datetime().nullable(),
  lockedSession: persistedSessionSchema.nullable(),
  lockedLeaderboard: z.array(persistedLeaderboardEntrySchema),
  nextSessionId: z.number().int().positive(),
  nextRacerId: z.number().int().positive(),
  simulation: persistedSimulationSchema.optional(),
});

const persistedLockedSnapshotContextSchema = z.object({
  lockedSession: persistedSessionSchema.nullable(),
  finalResults: z.array(persistedLeaderboardEntrySchema).nullable(),
});

const persistedRaceStateFileSchema = z.object({
  version: z.literal(PERSISTED_STATE_VERSION),
  state: persistedRaceStateSchema,
  lockedSnapshotContext: persistedLockedSnapshotContextSchema.optional(),
});

function validatePersistedState(state) {
  const parsed = persistedRaceStateSchema.parse(state);
  const activeSessionExists = parsed.activeSessionId
    ? parsed.sessions.some((session) => session.id === parsed.activeSessionId)
    : false;

  if (parsed.activeSessionId && !activeSessionExists) {
    throw new Error(
      `Persisted active session ${parsed.activeSessionId} does not exist in sessions.`
    );
  }

  if (
    !parsed.activeSessionId &&
    [RACE_STATES.STAGING, RACE_STATES.RUNNING, RACE_STATES.FINISHED].includes(
      parsed.raceState
    )
  ) {
    throw new Error(`Persisted ${parsed.raceState} state requires an active session.`);
  }

  if (parsed.raceState === RACE_STATES.RUNNING && parsed.remainingSeconds === 0) {
    throw new Error("Persisted RUNNING state must keep a positive remaining time.");
  }

  if (parsed.raceState !== RACE_STATES.RUNNING && parsed.timerEndsAt !== null) {
    throw new Error(`Persisted ${parsed.raceState} state cannot keep a live timer.`);
  }

  if (parsed.raceState === RACE_STATES.LOCKED) {
    if (parsed.lockedSession === null) {
      throw new Error("Persisted LOCKED state requires locked session data.");
    }
  }

  if (
    parsed.lockedSession !== null &&
    ![RACE_STATES.LOCKED, RACE_STATES.STAGING, RACE_STATES.IDLE].includes(parsed.raceState)
  ) {
    throw new Error(`Persisted ${parsed.raceState} state cannot keep locked session data.`);
  }
  return parsed;
}

function writeJsonAtomically(filePath, payload) {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });

  const tempFilePath = `${filePath}.tmp`;
  fs.writeFileSync(tempFilePath, JSON.stringify(payload, null, 2));
  fs.renameSync(tempFilePath, filePath);
}

function createNoopPersistenceAdapter() {
  return {
    enabled: false,
    load() {
      return null;
    },
    save() {},
  };
}

function createFilePersistenceAdapter({ filePath }) {
  return {
    enabled: true,
    load() {
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const raw = fs.readFileSync(filePath, "utf8");
      const parsedFile = persistedRaceStateFileSchema.parse(JSON.parse(raw));
      return {
        state: validatePersistedState(parsedFile.state),
        lockedSnapshotContext: parsedFile.lockedSnapshotContext
          ? persistedLockedSnapshotContextSchema.parse(parsedFile.lockedSnapshotContext)
          : null,
      };
    },
    save(nextPayload) {
      const state = validatePersistedState(nextPayload.state);
      const persistedPayload = {
        version: PERSISTED_STATE_VERSION,
        state,
      };

      if (nextPayload.lockedSnapshotContext) {
        persistedPayload.lockedSnapshotContext = persistedLockedSnapshotContextSchema.parse(
          nextPayload.lockedSnapshotContext
        );
      }

      writeJsonAtomically(filePath, persistedPayload);
    },
  };
}

function createPersistenceAdapter({ enabled, filePath }) {
  if (!enabled) {
    return createNoopPersistenceAdapter();
  }

  return createFilePersistenceAdapter({ filePath });
}

module.exports = {
  createPersistenceAdapter,
};
