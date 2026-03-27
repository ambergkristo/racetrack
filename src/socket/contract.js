const { z } = require("zod");
const { RACE_MODES, RACE_STATES } = require("../domain/raceStateMachine");
const { RACE_FLAGS } = require("../ui/raceTruth");

const SOCKET_EVENTS = Object.freeze({
  CLIENT_HELLO: "client:hello",
  SERVER_HELLO: "server:hello",
  SERVER_ERROR: "server:error",
  RACE_SNAPSHOT: "race:snapshot",
  RACE_TICK: "race:tick",
  LEADERBOARD_UPDATE: "leaderboard:update",
});

const socketAuthSchema = z
  .object({
    route: z.string().min(1),
    key: z.string().min(1).optional(),
  })
  .passthrough();

const clientHelloSchema = z
  .object({
    clientId: z.string().min(1).optional(),
    role: z.string().min(1).optional(),
    route: z.string().min(1),
  })
  .passthrough();

const serverHelloSchema = z.object({
  serverTime: z.string().datetime(),
  version: z.string().min(1),
  raceDurationSeconds: z.number().int().positive(),
  route: z.string().min(1),
  echo: z.unknown().optional(),
});

const serverErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
});

const racerSnapshotSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  carNumber: z.string().min(1).nullable(),
  lapCount: z.number().int().nonnegative(),
  currentLapTimeMs: z.number().int().positive().nullable(),
  bestLapTimeMs: z.number().int().positive().nullable(),
  lastCrossingTimestampMs: z.number().int().nonnegative().nullable(),
  finishPlace: z.number().int().positive().nullable(),
  finishRecordedAtMs: z.number().int().nonnegative().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const sessionSnapshotSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  racers: z.array(racerSnapshotSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const leaderboardEntrySchema = z.object({
  position: z.number().int().positive(),
  racerId: z.string().min(1),
  name: z.string().min(1),
  carNumber: z.string().min(1).nullable(),
  lapCount: z.number().int().nonnegative(),
  currentLapTimeMs: z.number().int().positive().nullable(),
  bestLapTimeMs: z.number().int().positive().nullable(),
  finishPlace: z.number().int().positive().nullable(),
});

const simulationStatusSchema = z.enum(["IDLE", "READY", "ACTIVE", "COMPLETED"]);

const simulationRacerSchema = z.object({
  racerId: z.string().min(1),
  progress: z.number().min(0).max(1),
  lapIndex: z.number().int().positive(),
  targetLapDurationMs: z.number().int().positive().nullable(),
  lapProgressMs: z.number().min(0),
  targetCompleted: z.boolean(),
  finishPlace: z.number().int().positive().nullable(),
});

const simulationSnapshotSchema = z.object({
  status: simulationStatusSchema,
  active: z.boolean(),
  sessionId: z.string().min(1).nullable(),
  startedAtMs: z.number().int().nonnegative().nullable(),
  endedAtMs: z.number().int().nonnegative().nullable(),
  maxDurationMs: z.number().int().positive().nullable(),
  targetLapCount: z.number().int().positive().nullable(),
  hardCapReached: z.boolean(),
  completionReason: z.string().min(1).nullable(),
  racers: z.array(simulationRacerSchema),
});

const raceFlagSchema = z.enum([
  RACE_FLAGS.IDLE,
  RACE_FLAGS.STAGING,
  RACE_FLAGS.SAFE,
  RACE_FLAGS.HAZARD_SLOW,
  RACE_FLAGS.HAZARD_STOP,
  RACE_FLAGS.CHECKERED,
  RACE_FLAGS.LOCKED,
]);

const raceSnapshotSchema = z.object({
  serverTime: z.string().datetime(),
  state: z.enum(Object.values(RACE_STATES)),
  stateLabel: z.string().min(1),
  stateDescription: z.string().min(1),
  flag: raceFlagSchema,
  resultsFinalized: z.boolean(),
  finishOrderActive: z.boolean(),
  simulation: simulationSnapshotSchema,
  mode: z.enum(Object.values(RACE_MODES)),
  lapEntryAllowed: z.boolean(),
  raceDurationSeconds: z.number().int().positive(),
  remainingSeconds: z.number().int().nonnegative(),
  endsAt: z.string().datetime().nullable(),
  activeSessionId: z.string().min(1).nullable(),
  activeSession: sessionSnapshotSchema.nullable(),
  currentSessionId: z.string().min(1).nullable(),
  currentSession: sessionSnapshotSchema.nullable(),
  nextSessionId: z.string().min(1).nullable(),
  nextSession: sessionSnapshotSchema.nullable(),
  queuedSessionIds: z.array(z.string().min(1)),
  queuedSessions: z.array(sessionSnapshotSchema),
  lockedSession: sessionSnapshotSchema.nullable(),
  finalResults: z.array(leaderboardEntrySchema).nullable(),
  sessions: z.array(sessionSnapshotSchema),
  leaderboard: z.array(leaderboardEntrySchema),
});

const raceTickSchema = z.object({
  serverTime: z.string().datetime(),
  state: z.enum(Object.values(RACE_STATES)),
  flag: z.enum(Object.values(RACE_FLAGS)),
  lapEntryAllowed: z.boolean(),
  raceDurationSeconds: z.number().int().positive(),
  remainingSeconds: z.number().int().nonnegative(),
  endsAt: z.string().datetime().nullable(),
  simulation: simulationSnapshotSchema.optional(),
});

const leaderboardUpdateSchema = z.object({
  serverTime: z.string().datetime(),
  state: z.enum(Object.values(RACE_STATES)),
  flag: z.enum(Object.values(RACE_FLAGS)),
  lapEntryAllowed: z.boolean(),
  activeSessionId: z.string().min(1).nullable(),
  finishOrderActive: z.boolean(),
  leaderboard: z.array(leaderboardEntrySchema),
});

module.exports = {
  SOCKET_EVENTS,
  socketAuthSchema,
  clientHelloSchema,
  leaderboardUpdateSchema,
  raceSnapshotSchema,
  raceTickSchema,
  serverHelloSchema,
  serverErrorSchema,
};
