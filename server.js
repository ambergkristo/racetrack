const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const { z } = require("zod");
const { Server } = require("socket.io");
const { loadEnvConfig } = require("./src/config/env");
const { createRaceStore, DomainError } = require("./src/domain/raceStore");
const { createIdempotencyStore } = require("./src/domain/idempotencyStore");
const { createTimerService } = require("./src/domain/timerService");
const { RACE_MODES, RACE_STATES } = require("./src/domain/raceStateMachine");
const { createPersistenceAdapter } = require("./src/persistence/raceStatePersistence");
const {
  buildRaceSnapshotViewModel,
  normalizeLockedSnapshotContext,
} = require("./src/ui/raceTruth");
const {
  SOCKET_EVENTS,
  socketAuthSchema,
  clientHelloSchema,
  leaderboardUpdateSchema,
  raceSnapshotSchema,
  raceTickSchema,
  serverHelloSchema,
  serverErrorSchema,
} = require("./src/socket/contract");

const PUBLIC_ROUTES = new Set([
  "/leader-board",
  "/next-race",
  "/race-countdown",
  "/race-flags",
]);

const SOCKET_TRANSPORTS = ["websocket"];
const FRONT_DESK_OR_RACE_CONTROL = ["/front-desk", "/race-control"];
const requestIdSchema = z.string().trim().min(1).max(120);

const createSessionSchema = z.object({
  name: z.string().trim().min(1).max(120),
  requestId: requestIdSchema.optional(),
});

const updateSessionSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    requestId: requestIdSchema.optional(),
  })
  .strict();

const createRacerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  carNumber: z.string().max(20).optional().nullable(),
  requestId: requestIdSchema.optional(),
});

const updateRacerSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    carNumber: z.string().max(20).optional().nullable(),
    requestId: requestIdSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).some((key) => key !== "requestId"), {
    message: "At least one racer field is required.",
  });

const selectSessionSchema = z.object({
  sessionId: z.string().min(1),
  requestId: requestIdSchema.optional(),
});

const raceModeSchema = z.object({
  mode: z.enum(Object.values(RACE_MODES)),
  requestId: requestIdSchema.optional(),
});

const lapCrossingSchema = z.object({
  racerId: z.string().min(1),
  timestampMs: z.number().int().nonnegative().optional(),
  requestId: requestIdSchema.optional(),
});

function createStaffSets(staffRouteToKey) {
  return {
    staffRoutes: new Set(Object.keys(staffRouteToKey)),
    spaRoutes: new Set(["/", ...PUBLIC_ROUTES, ...Object.keys(staffRouteToKey)]),
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verifyStaffKey(route, key, staffRouteToKey, authFailureDelayMs) {
  const envKeyName = staffRouteToKey[route];
  if (!envKeyName) {
    return { ok: false, code: "UNKNOWN_STAFF_ROUTE" };
  }

  const expected = process.env[envKeyName];
  if (key && expected && key === expected) {
    return { ok: true };
  }

  await delay(authFailureDelayMs);
  return { ok: false, code: "INVALID_KEY" };
}

function resolveStaticDir() {
  const builtDir = path.join(__dirname, "public");
  const sourceDir = path.join(__dirname, "client");
  const builtIndex = path.join(builtDir, "index.html");
  return fs.existsSync(builtIndex) ? builtDir : sourceDir;
}

function extractStaffCredentials(req) {
  const routeHeader = req.headers["x-staff-route"];
  const keyHeader = req.headers["x-staff-key"];

  return {
    route: typeof routeHeader === "string" ? routeHeader : req.body?.staffRoute,
    key: typeof keyHeader === "string" ? keyHeader : req.body?.staffKey,
  };
}

function parseBody(schema, req) {
  const result = schema.safeParse(req.body || {});
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new DomainError(
      "INVALID_REQUEST",
      issue?.message || "Request body failed validation.",
      400
    );
  }

  return result.data;
}

function normalizeOptionalHeaderValue(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized === "" ? null : normalized;
}

function stableSerialize(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(",")}]`;
  }

  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
    .join(",")}}`;
}

function extractIdempotencyKey(req) {
  return (
    normalizeOptionalHeaderValue(req.headers["idempotency-key"]) ||
    normalizeOptionalHeaderValue(req.headers["x-idempotency-key"]) ||
    normalizeOptionalHeaderValue(req.headers["x-request-id"]) ||
    normalizeOptionalHeaderValue(req.body?.requestId)
  );
}

function buildRequestFingerprint(req) {
  return stableSerialize({
    method: req.method,
    path: req.path,
    staffRoute: req.staffRoute || null,
    body: req.body || null,
  });
}

function toErrorResponse(error) {
  if (error instanceof DomainError) {
    return {
      status: error.status,
      body: {
        ok: false,
        code: error.code,
        message: error.message,
      },
    };
  }

  throw error;
}

function sendError(res, error) {
  if (error instanceof DomainError) {
    return res.status(error.status).json({
      ok: false,
      code: error.code,
      message: error.message,
    });
  }

  return res.status(500).json({
    ok: false,
    code: "INTERNAL_ERROR",
    message: "Internal server error.",
  });
}

function createStaffAuthMiddleware({ allowedRoutes, env }) {
  return async (req, res, next) => {
    const { route, key } = extractStaffCredentials(req);
    if (!route || !key) {
      return res.status(401).json({
        ok: false,
        code: "STAFF_AUTH_REQUIRED",
        message: "Staff route and key are required for this action.",
      });
    }

    if (!allowedRoutes.includes(route)) {
      return res.status(403).json({
        ok: false,
        code: "STAFF_ROUTE_FORBIDDEN",
        message: "This staff route cannot perform the requested action.",
      });
    }

    const result = await verifyStaffKey(
      route,
      key,
      env.staffRouteToKey,
      env.authFailureDelayMs
    );
    if (!result.ok) {
      return res.status(401).json({
        ok: false,
        code: result.code,
        message: "Invalid access key.",
      });
    }

    req.staffRoute = route;
    return next();
  };
}

function createApp(options = {}) {
  const env = loadEnvConfig();
  const { staffRoutes, spaRoutes } = createStaffSets(env.staffRouteToKey);
  const tickIntervalMs = options.tickIntervalMs || 1000;

  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: true, credentials: true },
    transports: SOCKET_TRANSPORTS,
    allowUpgrades: false,
  });

  const raceDurationSeconds = env.raceDurationSeconds;
  const persistenceAdapter =
    options.persistenceAdapter ||
    createPersistenceAdapter({
      enabled: env.featureFlags.FF_PERSISTENCE,
      filePath: options.persistenceFilePath || env.persistenceFilePath,
    });
  const restoredPersistence = persistenceAdapter.load();
  const restoredState = restoredPersistence?.state || null;
  let lockedSnapshotContext = normalizeLockedSnapshotContext(
    restoredPersistence?.lockedSnapshotContext
  );
  const raceStore = createRaceStore({
    raceDurationSeconds,
    now: options.now,
    restoredState,
  });
  const idempotencyStore = createIdempotencyStore();
  const staticDir = resolveStaticDir();

  function buildRaceSnapshotPayload() {
    return raceSnapshotSchema.parse({
      serverTime: new Date().toISOString(),
      ...buildRaceSnapshotViewModel(raceStore.getSnapshot(), lockedSnapshotContext),
    });
  }

  function buildLeaderboardPayload() {
    const snapshot = raceStore.getSnapshot();
    return leaderboardUpdateSchema.parse({
      serverTime: new Date().toISOString(),
      state: snapshot.state,
      activeSessionId: snapshot.activeSessionId,
      leaderboard: snapshot.leaderboard,
    });
  }

  function buildRaceTickPayload() {
    const snapshot = raceStore.getSnapshot();
    return raceTickSchema.parse({
      serverTime: new Date().toISOString(),
      state: snapshot.state,
      raceDurationSeconds,
      remainingSeconds: snapshot.remainingSeconds,
      endsAt: snapshot.endsAt,
    });
  }

  function persistCanonicalState() {
    const exportedState = raceStore.exportState();
    if (exportedState.raceState !== RACE_STATES.LOCKED) {
      lockedSnapshotContext = normalizeLockedSnapshotContext();
    }

    persistenceAdapter.save({
      state: exportedState,
      lockedSnapshotContext:
        exportedState.raceState === RACE_STATES.LOCKED ? lockedSnapshotContext : null,
    });
  }

  function broadcastCanonicalState() {
    io.emit(SOCKET_EVENTS.RACE_SNAPSHOT, buildRaceSnapshotPayload());
    io.emit(SOCKET_EVENTS.LEADERBOARD_UPDATE, buildLeaderboardPayload());
  }

  function emitResyncState(socket) {
    socket.emit(SOCKET_EVENTS.RACE_SNAPSHOT, buildRaceSnapshotPayload());
    socket.emit(SOCKET_EVENTS.LEADERBOARD_UPDATE, buildLeaderboardPayload());

    const snapshot = raceStore.getSnapshot();
    if (
      snapshot.state === RACE_STATES.RUNNING ||
      snapshot.state === RACE_STATES.FINISHED
    ) {
      socket.emit(SOCKET_EVENTS.RACE_TICK, buildRaceTickPayload());
    }
  }

  async function executeMutation(req, res, operation) {
    try {
      const response = await idempotencyStore.run({
        key: extractIdempotencyKey(req),
        fingerprint: buildRequestFingerprint(req),
        execute: async () => {
          try {
            return await operation();
          } catch (error) {
            return toErrorResponse(error);
          }
        },
      });

      return res.status(response.status).json(response.body);
    } catch (error) {
      return sendError(res, error);
    }
  }

  const timerService = createTimerService({
    durationSeconds: raceDurationSeconds,
    tickIntervalMs,
    now: options.now,
    onTick: ({ remainingSeconds, endsAt }) => {
      raceStore.syncTimer({ remainingSeconds, endsAt });
      io.emit(SOCKET_EVENTS.RACE_TICK, buildRaceTickPayload());
      if (remainingSeconds > 0) {
        persistCanonicalState();
      }
    },
    onFinished: () => {
      try {
        raceStore.syncTimer({ remainingSeconds: 0, endsAt: null });
        io.emit(SOCKET_EVENTS.RACE_TICK, buildRaceTickPayload());
        raceStore.finishRace({ reason: "timer_elapsed" });
        broadcastCanonicalState();
        persistCanonicalState();
      } catch (error) {
        if (!(error instanceof DomainError)) {
          throw error;
        }
      }
    },
  });

  const frontDeskOrRaceControlAuth = createStaffAuthMiddleware({
    allowedRoutes: FRONT_DESK_OR_RACE_CONTROL,
    env,
  });
  const raceControlAuth = createStaffAuthMiddleware({
    allowedRoutes: ["/race-control"],
    env,
  });
  const lapTrackerAuth = createStaffAuthMiddleware({
    allowedRoutes: ["/lap-line-tracker"],
    env,
  });

  if (restoredState && restoredState.raceState === RACE_STATES.RUNNING) {
    const resumedTimer = timerService.resume({
      remainingSeconds: restoredState.remainingSeconds,
    });
    raceStore.syncTimer(resumedTimer);
  }

  persistCanonicalState();

  app.use(express.json({ limit: "64kb" }));
  app.use(express.static(staticDir, { index: false }));

  app.get("/healthz", (_req, res) => {
    res.status(200).json({
      status: "ok",
      raceDurationSeconds,
      raceState: raceStore.getSnapshot().state,
      nodeEnv: process.env.NODE_ENV || "development",
    });
  });

  app.get("/api/bootstrap", (_req, res) => {
    res.status(200).json({
      raceDurationSeconds,
      serverTime: new Date().toISOString(),
      raceSnapshot: buildRaceSnapshotPayload(),
    });
  });

  app.get("/api/race", (_req, res) => {
    res.status(200).json(buildRaceSnapshotPayload());
  });

  app.get("/api/sessions", (_req, res) => {
    const snapshot = buildRaceSnapshotPayload();
    res.status(200).json({
      serverTime: new Date().toISOString(),
      activeSessionId: snapshot.activeSessionId,
      sessions: snapshot.sessions,
    });
  });

  app.post("/api/auth/verify", async (req, res) => {
    const route = req.body?.route;
    const key = req.body?.key;
    if (!staffRoutes.has(route)) {
      return res.status(400).json({
        ok: false,
        code: "INVALID_ROUTE",
        message: "Route is not a staff route.",
      });
    }

    const result = await verifyStaffKey(
      route,
      key,
      env.staffRouteToKey,
      env.authFailureDelayMs
    );
    if (!result.ok) {
      return res.status(401).json({
        ok: false,
        code: result.code,
        message: "Invalid access key.",
      });
    }

    return res.status(200).json({ ok: true });
  });

  app.post("/api/sessions", frontDeskOrRaceControlAuth, (req, res) =>
    executeMutation(req, res, async () => {
      const { name } = parseBody(createSessionSchema, req);
      const session = raceStore.createSession({ name });
      broadcastCanonicalState();
      persistCanonicalState();
      return {
        status: 201,
        body: {
          ok: true,
          session,
          raceSnapshot: buildRaceSnapshotPayload(),
        },
      };
    })
  );

  app.patch("/api/sessions/:sessionId", frontDeskOrRaceControlAuth, (req, res) =>
    executeMutation(req, res, async () => {
      const { name } = parseBody(updateSessionSchema, req);
      const session = raceStore.updateSession(req.params.sessionId, { name });
      broadcastCanonicalState();
      persistCanonicalState();
      return {
        status: 200,
        body: {
          ok: true,
          session,
          raceSnapshot: buildRaceSnapshotPayload(),
        },
      };
    })
  );

  app.delete("/api/sessions/:sessionId", frontDeskOrRaceControlAuth, (req, res) =>
    executeMutation(req, res, async () => {
      const session = raceStore.deleteSession(req.params.sessionId);
      broadcastCanonicalState();
      persistCanonicalState();
      return {
        status: 200,
        body: {
          ok: true,
          session,
          raceSnapshot: buildRaceSnapshotPayload(),
        },
      };
    })
  );

  app.post("/api/race/session/select", frontDeskOrRaceControlAuth, (req, res) =>
    executeMutation(req, res, async () => {
      const { sessionId } = parseBody(selectSessionSchema, req);
      const session = raceStore.selectSession(sessionId);
      broadcastCanonicalState();
      persistCanonicalState();
      return {
        status: 200,
        body: {
          ok: true,
          session,
          raceSnapshot: buildRaceSnapshotPayload(),
        },
      };
    })
  );

  app.post(
    "/api/sessions/:sessionId/racers",
    frontDeskOrRaceControlAuth,
    (req, res) =>
      executeMutation(req, res, async () => {
        const { name, carNumber } = parseBody(createRacerSchema, req);
        const racer = raceStore.addRacer(req.params.sessionId, {
          name,
          carNumber,
        });
        broadcastCanonicalState();
        persistCanonicalState();
        return {
          status: 201,
          body: {
            ok: true,
            racer,
            raceSnapshot: buildRaceSnapshotPayload(),
          },
        };
      })
  );

  app.patch(
    "/api/sessions/:sessionId/racers/:racerId",
    frontDeskOrRaceControlAuth,
    (req, res) =>
      executeMutation(req, res, async () => {
        const { name, carNumber } = parseBody(updateRacerSchema, req);
        const racer = raceStore.updateRacer(req.params.sessionId, req.params.racerId, {
          name,
          carNumber,
        });
        broadcastCanonicalState();
        persistCanonicalState();
        return {
          status: 200,
          body: {
            ok: true,
            racer,
            raceSnapshot: buildRaceSnapshotPayload(),
          },
        };
      })
  );

  app.delete(
    "/api/sessions/:sessionId/racers/:racerId",
    frontDeskOrRaceControlAuth,
    (req, res) =>
      executeMutation(req, res, async () => {
        const racer = raceStore.removeRacer(req.params.sessionId, req.params.racerId);
        broadcastCanonicalState();
        persistCanonicalState();
        return {
          status: 200,
          body: {
            ok: true,
            racer,
            raceSnapshot: buildRaceSnapshotPayload(),
          },
        };
      })
  );

  app.post("/api/race/start", raceControlAuth, (req, res) =>
    executeMutation(req, res, async () => {
      const session = raceStore.startRace();
      const timerState = timerService.start();
      raceStore.syncTimer(timerState);
      broadcastCanonicalState();
      persistCanonicalState();
      return {
        status: 200,
        body: {
          ok: true,
          session,
          raceSnapshot: buildRaceSnapshotPayload(),
        },
      };
    })
  );

  app.post("/api/race/mode", raceControlAuth, (req, res) =>
    executeMutation(req, res, async () => {
      const { mode } = parseBody(raceModeSchema, req);
      const nextMode = raceStore.setRaceMode(mode);
      broadcastCanonicalState();
      persistCanonicalState();
      return {
        status: 200,
        body: {
          ok: true,
          mode: nextMode,
          raceSnapshot: buildRaceSnapshotPayload(),
        },
      };
    })
  );

  app.post("/api/race/finish", raceControlAuth, (req, res) =>
    executeMutation(req, res, async () => {
      timerService.stop();
      raceStore.finishRace({ reason: "manual" });
      broadcastCanonicalState();
      persistCanonicalState();
      return {
        status: 200,
        body: {
          ok: true,
          raceSnapshot: buildRaceSnapshotPayload(),
        },
      };
    })
  );

  app.post("/api/race/lock", raceControlAuth, (req, res) =>
    executeMutation(req, res, async () => {
      timerService.stop();
      const preLockSnapshot = raceStore.getSnapshot();
      const session = raceStore.lockRace();
      lockedSnapshotContext = normalizeLockedSnapshotContext({
        lockedSession: session,
        finalResults: preLockSnapshot.leaderboard,
      });
      broadcastCanonicalState();
      persistCanonicalState();
      return {
        status: 200,
        body: {
          ok: true,
          session,
          raceSnapshot: buildRaceSnapshotPayload(),
        },
      };
    })
  );

  app.post("/api/laps/crossing", lapTrackerAuth, (req, res) =>
    executeMutation(req, res, async () => {
      const { racerId, timestampMs } = parseBody(lapCrossingSchema, req);
      const racer = raceStore.recordLapCrossing({ racerId, timestampMs });
      broadcastCanonicalState();
      persistCanonicalState();
      return {
        status: 200,
        body: {
          ok: true,
          racer,
          raceSnapshot: buildRaceSnapshotPayload(),
        },
      };
    })
  );

  io.use(async (socket, next) => {
    const authResult = socketAuthSchema.safeParse(socket.handshake.auth || {});
    if (!authResult.success) {
      return next(new Error("AUTH_INVALID"));
    }

    const route = authResult.data.route;
    if (!staffRoutes.has(route)) {
      return next();
    }

    const key = authResult.data.key;
    const result = await verifyStaffKey(
      route,
      key,
      env.staffRouteToKey,
      env.authFailureDelayMs
    );
    if (!result.ok) {
      return next(new Error("AUTH_INVALID"));
    }

    return next();
  });

  io.on("connection", (socket) => {
    const route = socket.handshake.auth?.route || "unknown";
    socket.emit(
      SOCKET_EVENTS.SERVER_HELLO,
      serverHelloSchema.parse({
        serverTime: new Date().toISOString(),
        version: "m1",
        raceDurationSeconds,
        route,
      })
    );
    emitResyncState(socket);

    socket.on(SOCKET_EVENTS.CLIENT_HELLO, (payload) => {
      const parsedClientHello = clientHelloSchema.safeParse(payload || {});
      if (!parsedClientHello.success) {
        socket.emit(
          SOCKET_EVENTS.SERVER_ERROR,
          serverErrorSchema.parse({
            code: "INVALID_CLIENT_HELLO",
            message: "client:hello payload failed validation.",
          })
        );
        return;
      }

      socket.emit(
        SOCKET_EVENTS.SERVER_HELLO,
        serverHelloSchema.parse({
          serverTime: new Date().toISOString(),
          version: "m1",
          raceDurationSeconds,
          route,
          echo: parsedClientHello.data,
        })
      );
      emitResyncState(socket);
    });
  });

  app.get("*", (req, res, next) => {
    if (
      req.path.startsWith("/api") ||
      req.path.startsWith("/socket.io") ||
      req.path === "/healthz"
    ) {
      return next();
    }

    if (spaRoutes.has(req.path) || req.path === "/") {
      return res.sendFile(path.join(staticDir, "index.html"));
    }

    return res.status(404).json({ error: "Not found" });
  });

  return {
    app,
    server,
    raceDurationSeconds,
    raceStore,
    timerService,
    persistenceAdapter,
  };
}

if (require.main === module) {
  try {
    const { server, raceDurationSeconds } = createApp();
    const port = Number.parseInt(process.env.PORT || "3000", 10);
    server.listen(port, () => {
      console.log(
        `Racetrack M1 server listening on port ${port} (raceDurationSeconds=${raceDurationSeconds})`
      );
    });
  } catch (error) {
    console.error(`Startup failed: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { createApp };
