const { z } = require("zod");
const { RACE_MODES, RACE_STATES } = require("../domain/raceStateMachine");

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
});

const raceSnapshotSchema = z.object({
  serverTime: z.string().datetime(),
  state: z.enum(Object.values(RACE_STATES)),
  mode: z.enum(Object.values(RACE_MODES)),
  raceDurationSeconds: z.number().int().positive(),
  remainingSeconds: z.number().int().nonnegative(),
  endsAt: z.string().datetime().nullable(),
  activeSessionId: z.string().min(1).nullable(),
  activeSession: sessionSnapshotSchema.nullable(),
  sessions: z.array(sessionSnapshotSchema),
  leaderboard: z.array(leaderboardEntrySchema),
});

const raceTickSchema = z.object({
  serverTime: z.string().datetime(),
  state: z.enum(Object.values(RACE_STATES)),
  raceDurationSeconds: z.number().int().positive(),
  remainingSeconds: z.number().int().nonnegative(),
  endsAt: z.string().datetime().nullable(),
});

const leaderboardUpdateSchema = z.object({
  serverTime: z.string().datetime(),
  state: z.enum(Object.values(RACE_STATES)),
  activeSessionId: z.string().min(1).nullable(),
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
