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
    if (parsed.activeSessionId !== null) {
      throw new Error("Persisted LOCKED state cannot keep an active session.");
    }
    if (parsed.lockedSession === null) {
      throw new Error("Persisted LOCKED state requires locked session data.");
    }
  }

  if (parsed.raceState !== RACE_STATES.LOCKED && parsed.lockedSession !== null) {
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

      if (state.raceState === RACE_STATES.LOCKED && nextPayload.lockedSnapshotContext) {
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
