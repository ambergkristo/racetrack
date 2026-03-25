const fs = require("fs");
const path = require("path");
const { z } = require("zod");
const { RACE_MODES, RACE_STATES } = require("../domain/raceStateMachine");

const PERSISTED_STATE_VERSION = 1;

const persistedRacerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  carNumber: z.string().min(1).nullable(),
  lapCount: z.number().int().nonnegative(),
  currentLapTimeMs: z.number().int().positive().nullable(),
  bestLapTimeMs: z.number().int().positive().nullable(),
  lastCrossingTimestampMs: z.number().int().nonnegative().nullable(),
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

const persistedRaceStateSchema = z.object({
  raceState: z.enum(Object.values(RACE_STATES)),
  raceMode: z.enum(Object.values(RACE_MODES)),
  activeSessionId: z.string().min(1).nullable(),
  sessions: z.array(persistedSessionSchema),
  remainingSeconds: z.number().int().nonnegative(),
  timerEndsAt: z.string().datetime().nullable(),
  nextSessionId: z.number().int().positive(),
  nextRacerId: z.number().int().positive(),
});

const persistedRaceStateFileSchema = z.object({
  version: z.literal(PERSISTED_STATE_VERSION),
  state: persistedRaceStateSchema,
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
      return validatePersistedState(parsedFile.state);
    },
    save(state) {
      const payload = {
        version: PERSISTED_STATE_VERSION,
        state: validatePersistedState(state),
      };
      writeJsonAtomically(filePath, payload);
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
