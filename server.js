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
const { createPersistenceAdapter } = require("./src/persistence/raceStatePersistence");
const { RACE_MODES, RACE_STATES } = require("./src/domain/raceStateMachine");
const { createLogger } = require("./src/observability/logger");
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

function toErrorResponse(error, logger, req) {
  if (error instanceof DomainError) {
    logger.warn("http.domain_error", {
      method: req.method,
      path: req.path,
      code: error.code,
      status: error.status,
      message: error.message,
    });
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

function sendError(res, error, logger, req) {
  if (error instanceof DomainError) {
    logger.warn("http.domain_error", {
      method: req.method,
      path: req.path,
      code: error.code,
      status: error.status,
      message: error.message,
    });
    return res.status(error.status).json({
      ok: false,
      code: error.code,
      message: error.message,
    });
  }

  logger.error("http.internal_error", {
    method: req.method,
    path: req.path,
    error,
  });
  return res.status(500).json({
    ok: false,
    code: "INTERNAL_ERROR",
    message: "Internal server error.",
  });
}

function createStaffAuthMiddleware({ allowedRoutes, env, logger }) {
  return async (req, res, next) => {
    const { route, key } = extractStaffCredentials(req);
    if (!route) {
      logger.warn("http.staff_auth_failed", {
        method: req.method,
        path: req.path,
        route: route || null,
        reason: "STAFF_AUTH_REQUIRED",
      });
      return res.status(401).json({
        ok: false,
        code: "STAFF_AUTH_REQUIRED",
        message: "Staff route and key are required for this action.",
      });
    }

    if (!allowedRoutes.includes(route)) {
      logger.warn("http.staff_auth_failed", {
        method: req.method,
        path: req.path,
        route,
        reason: "STAFF_ROUTE_FORBIDDEN",
      });
      return res.status(403).json({
        ok: false,
        code: "STAFF_ROUTE_FORBIDDEN",
        message: "This staff route cannot perform the requested action.",
      });
    }

    if (env.staffAuthDisabled) {
      req.staffRoute = route;
      return next();
    }

    if (!key) {
      logger.warn("http.staff_auth_failed", {
        method: req.method,
        path: req.path,
        route,
        reason: "STAFF_AUTH_REQUIRED",
      });
      return res.status(401).json({
        ok: false,
        code: "STAFF_AUTH_REQUIRED",
        message: "Staff route and key are required for this action.",
      });
    }

    const result = await verifyStaffKey(
      route,
      key,
      env.staffRouteToKey,
      env.authFailureDelayMs
    );
    if (!result.ok) {
      logger.warn("http.staff_auth_failed", {
        method: req.method,
        path: req.path,
        route,
        reason: result.code,
      });
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
  const logger = options.logger || createLogger({ baseFields: { service: "racetrack" } });

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
      flag: snapshot.flag,
      lapEntryAllowed: snapshot.lapEntryAllowed,
      activeSessionId: snapshot.activeSessionId,
      finishOrderActive: Boolean(snapshot.finishOrderActive),
      leaderboard: snapshot.leaderboard,
    });
  }

  function buildRaceTickPayload() {
    const snapshot = raceStore.getSnapshot();
    return raceTickSchema.parse({
      serverTime: new Date().toISOString(),
      state: snapshot.state,
      flag: snapshot.flag,
      lapEntryAllowed: snapshot.lapEntryAllowed,
      raceDurationSeconds,
      remainingSeconds: snapshot.remainingSeconds,
      endsAt: snapshot.endsAt,
    });
  }

  function emitCanonicalState(
    target,
    { reason, socketId = null, route = null, includeTick = false }
  ) {
    const snapshot = buildRaceSnapshotPayload();
    const leaderboard = buildLeaderboardPayload();
    target.emit(SOCKET_EVENTS.RACE_SNAPSHOT, snapshot);
    target.emit(SOCKET_EVENTS.LEADERBOARD_UPDATE, leaderboard);
    if (
      includeTick &&
      (snapshot.state === RACE_STATES.RUNNING || snapshot.state === RACE_STATES.FINISHED)
    ) {
      target.emit(SOCKET_EVENTS.RACE_TICK, buildRaceTickPayload());
    }
    logger.info("socket.resync_emitted", {
      delivery: socketId ? "socket" : "broadcast",
      reason,
      socketId,
      route,
      state: snapshot.state,
      activeSessionId: snapshot.activeSessionId,
      leaderboardSize: leaderboard.leaderboard.length,
    });
  }

  function broadcastCanonicalState(reason) {
    emitCanonicalState(io, { reason });
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

  async function executeMutation(req, res, operation) {
    try {
      const response = await idempotencyStore.run({
        key: extractIdempotencyKey(req),
        fingerprint: buildRequestFingerprint(req),
        execute: async () => {
          try {
            return await operation();
          } catch (error) {
            return toErrorResponse(error, logger, req);
          }
        },
      });

      return res.status(response.status).json(response.body);
    } catch (error) {
      return sendError(res, error, logger, req);
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
        raceStore.finishRace({ reason: "timer_elapsed" });
        raceStore.syncTimer({ remainingSeconds: 0, endsAt: null });
        io.emit(SOCKET_EVENTS.RACE_TICK, buildRaceTickPayload());
        logger.info("race.timer_elapsed", {
          state: raceStore.getSnapshot().state,
        });
        broadcastCanonicalState("race_finished_timer_elapsed");
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
    logger,
  });
  const raceControlAuth = createStaffAuthMiddleware({
    allowedRoutes: ["/race-control"],
    env,
    logger,
  });
  const lapTrackerAuth = createStaffAuthMiddleware({
    allowedRoutes: ["/lap-line-tracker"],
    env,
    logger,
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
      featureFlags: env.featureFlags,
      staffAuthDisabled: env.staffAuthDisabled,
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
      logger.warn("http.staff_auth_failed", {
        method: req.method,
        path: req.path,
        route: route || null,
        reason: "INVALID_ROUTE",
      });
      return res.status(400).json({
        ok: false,
        code: "INVALID_ROUTE",
        message: "Route is not a staff route.",
      });
    }

    if (env.staffAuthDisabled) {
      return res.status(200).json({ ok: true, bypassed: true });
    }

    const result = await verifyStaffKey(
      route,
      key,
      env.staffRouteToKey,
      env.authFailureDelayMs
    );
    if (!result.ok) {
      logger.warn("http.staff_auth_failed", {
        method: req.method,
        path: req.path,
        route,
        reason: result.code,
      });
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
      broadcastCanonicalState("session_created");
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
      broadcastCanonicalState("session_updated");
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
      broadcastCanonicalState("session_deleted");
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
      broadcastCanonicalState("session_selected");
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
        broadcastCanonicalState("racer_added");
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
        broadcastCanonicalState("racer_updated");
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
        broadcastCanonicalState("racer_removed");
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
      broadcastCanonicalState("race_started");
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
      broadcastCanonicalState("race_mode_changed");
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
      broadcastCanonicalState("race_finished_manual");
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
      broadcastCanonicalState("race_locked");
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
      broadcastCanonicalState("lap_recorded");
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
      logger.warn("socket.auth_invalid", {
        socketId: socket.id,
        route: socket.handshake.auth?.route || null,
        reason: "schema_validation_failed",
      });
      return next(new Error("AUTH_INVALID"));
    }

    const route = authResult.data.route;
    if (!staffRoutes.has(route)) {
      return next();
    }

    if (env.staffAuthDisabled) {
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
      logger.warn("socket.auth_invalid", {
        socketId: socket.id,
        route,
        reason: result.code,
      });
      return next(new Error("AUTH_INVALID"));
    }

    return next();
  });

  io.on("connection", (socket) => {
    const route = socket.handshake.auth?.route || "unknown";
    logger.info("socket.connected", {
      socketId: socket.id,
      route,
    });
    socket.emit(
      SOCKET_EVENTS.SERVER_HELLO,
      serverHelloSchema.parse({
        serverTime: new Date().toISOString(),
        version: "m1",
        raceDurationSeconds,
        route,
      })
    );
    emitCanonicalState(socket, {
      reason: "socket_connected",
      socketId: socket.id,
      route,
      includeTick: true,
    });

    socket.on(SOCKET_EVENTS.CLIENT_HELLO, (payload) => {
      try {
        const parsedClientHello = clientHelloSchema.safeParse(payload || {});
        if (!parsedClientHello.success) {
          logger.warn("socket.client_payload_invalid", {
            socketId: socket.id,
            route,
            eventName: SOCKET_EVENTS.CLIENT_HELLO,
            issues: parsedClientHello.error.issues.map((issue) => issue.message),
          });
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
        emitCanonicalState(socket, {
          reason: "client_hello_resync",
          socketId: socket.id,
          route,
          includeTick: true,
        });
      } catch (error) {
        logger.error("socket.internal_error", {
          socketId: socket.id,
          route,
          eventName: SOCKET_EVENTS.CLIENT_HELLO,
          error,
        });
        socket.emit(
          SOCKET_EVENTS.SERVER_ERROR,
          serverErrorSchema.parse({
            code: "INTERNAL_SOCKET_ERROR",
            message: "Unexpected socket error.",
          })
        );
      }
    });

    socket.on("disconnect", (reason) => {
      logger.info("socket.disconnected", {
        socketId: socket.id,
        route,
        reason,
      });
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
    logger,
    persistenceAdapter,
  };
}

if (require.main === module) {
  try {
    const { server, raceDurationSeconds, logger } = createApp();
    const port = Number.parseInt(process.env.PORT || "3000", 10);
    server.listen(port, () => {
      logger.info("server.started", {
        port,
        raceDurationSeconds,
      });
      console.log(
        `Racetrack M1 server listening on port ${port} (raceDurationSeconds=${raceDurationSeconds})`
      );
    });
  } catch (error) {
    createLogger({ baseFields: { service: "racetrack" } }).error("server.start_failed", {
      error,
    });
    console.error(`Startup failed: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { createApp };
