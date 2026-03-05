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

module.exports = {
  SOCKET_EVENTS,
  socketAuthSchema,
  clientHelloSchema,
  serverHelloSchema,
  serverErrorSchema,
};
