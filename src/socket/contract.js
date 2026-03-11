const { z } = require("zod");

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

const rosterEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kart: z.string().min(1),
  lane: z.string().min(1),
});

const flagStateSchema = z.object({
  code: z.enum(["SAFE", "HAZARD", "STOP", "FINISHED"]),
  tone: z.enum(["safe", "warning", "danger"]),
  label: z.string().min(1),
  detail: z.string().min(1),
});

const raceCardSchema = z.object({
  number: z.number().int().positive(),
  title: z.string().min(1),
  status: z.string().min(1),
  totalLaps: z.number().int().nonnegative(),
  lapsCompleted: z.number().int().nonnegative(),
  scheduledInSeconds: z.number().int().nonnegative(),
  racers: z.array(rosterEntrySchema),
  pitMessage: z.string().min(1),
  queueStatus: z.string().min(1),
});

const raceSnapshotSchema = z.object({
  generatedAt: z.string().datetime(),
  phase: z.enum(["STAGING", "RUNNING", "FINISHED", "LOCKED"]),
  phaseLabel: z.string().min(1),
  countdownSeconds: z.number().int().nonnegative(),
  elapsedSeconds: z.number().int().nonnegative(),
  raceDurationSeconds: z.number().int().positive(),
  progressRatio: z.number().min(0).max(1),
  currentRace: raceCardSchema,
  nextRace: raceCardSchema,
  flag: flagStateSchema,
  queue: z.object({
    readyCount: z.number().int().nonnegative(),
    totalCount: z.number().int().positive(),
    pitMessage: z.string().min(1),
  }),
  venue: z.string().min(1),
});

const raceTickSchema = z.object({
  generatedAt: z.string().datetime(),
  phase: z.enum(["STAGING", "RUNNING", "FINISHED", "LOCKED"]),
  raceNumber: z.number().int().positive(),
  countdownSeconds: z.number().int().nonnegative(),
  elapsedSeconds: z.number().int().nonnegative(),
  progressRatio: z.number().min(0).max(1),
  flagCode: z.enum(["SAFE", "HAZARD", "STOP", "FINISHED"]),
});

const leaderboardEntrySchema = z.object({
  position: z.number().int().positive(),
  name: z.string().min(1),
  kart: z.string().min(1),
  laps: z.number().int().nonnegative(),
  bestLapMs: z.number().int().nonnegative(),
  lastLapMs: z.number().int().nonnegative().nullable(),
  gapMs: z.number().int().nonnegative(),
});

const leaderboardUpdateSchema = z.object({
  generatedAt: z.string().datetime(),
  raceNumber: z.number().int().positive(),
  phase: z.enum(["STAGING", "RUNNING", "FINISHED", "LOCKED"]),
  entries: z.array(leaderboardEntrySchema).min(1),
});

module.exports = {
  SOCKET_EVENTS,
  socketAuthSchema,
  clientHelloSchema,
  serverHelloSchema,
  serverErrorSchema,
  raceSnapshotSchema,
  raceTickSchema,
  leaderboardUpdateSchema,
};
