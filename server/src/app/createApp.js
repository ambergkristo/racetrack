const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { loadEnvConfig } = require("../config/env");
const { createRaceStore, DomainError } = require("../domain/raceStore");
const { createIdempotencyStore } = require("../domain/idempotencyStore");
const { createTimerService } = require("../domain/timerService");
const { createPersistenceAdapter } = require("../persistence/raceStatePersistence");
const { RACE_STATES } = require("../domain/raceStateMachine");
const { createLogger } = require("../observability/logger");
const { normalizeLockedSnapshotContext } = require("../ui/raceTruth");
const { SOCKET_EVENTS } = require("../socket/contract");
const {
  createStaffSets,
  SOCKET_TRANSPORTS,
  FRONT_DESK_OR_RACE_CONTROL,
} = require("./config/routes");
const { createStaffAuthMiddleware, verifyStaffKey } = require("./middleware/staffAuth");
const { resolveStaticDir } = require("./services/staticDir");
const { createMutationExecutor } = require("./services/mutationExecutor");
const { createRealtimeService } = require("./services/realtime");
const { createSimulationLoop } = require("./services/simulationLoop");
const { registerRaceSocketHandlers } = require("./sockets/registerRaceSocketHandlers");
const { registerApiRoutes } = require("./routes/registerApiRoutes");
const { registerSpaRoutes } = require("./routes/registerSpaRoutes");

function resolveRecoveredRemainingSeconds(restoredState, nowMs) {
  const restoredEndsAtMs = Date.parse(restoredState?.timerEndsAt || "");
  if (Number.isFinite(restoredEndsAtMs)) {
    return Math.max(0, Math.ceil((restoredEndsAtMs - nowMs) / 1000));
  }

  return Number.isInteger(restoredState?.remainingSeconds)
    ? Math.max(0, restoredState.remainingSeconds)
    : 0;
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
    simulationConfig: options.simulationConfig,
    manualCarAssignmentEnabled: env.featureFlags.FF_MANUAL_CAR_ASSIGNMENT,
  });
  const idempotencyStore = createIdempotencyStore();
  const staticDir = resolveStaticDir(process.cwd());

  const realtimeService = createRealtimeService({
    io,
    logger,
    raceStore,
    raceDurationSeconds,
    persistenceAdapter,
    getLockedSnapshotContext: () => lockedSnapshotContext,
  });

  const timerService = createTimerService({
    durationSeconds: raceDurationSeconds,
    tickIntervalMs,
    now: options.now,
    onTick: ({ remainingSeconds, endsAt }) => {
      raceStore.syncTimer({ remainingSeconds, endsAt });
      io.emit(SOCKET_EVENTS.RACE_TICK, realtimeService.buildRaceTickPayload());
      if (remainingSeconds > 0) {
        realtimeService.persistCanonicalState();
      }
    },
    onFinished: () => {
      try {
        raceStore.finishRace({ reason: "timer_elapsed" });
        raceStore.syncTimer({ remainingSeconds: 0, endsAt: null });
        io.emit(SOCKET_EVENTS.RACE_TICK, realtimeService.buildRaceTickPayload());
        logger.info("race.timer_elapsed", {
          state: raceStore.getSnapshot().state,
        });
        realtimeService.broadcastCanonicalState("race_finished_timer_elapsed");
        realtimeService.persistCanonicalState();
      } catch (error) {
        if (!(error instanceof DomainError)) {
          throw error;
        }
      }
    },
  });

  const simulationLoop = createSimulationLoop({
    raceStore,
    timerService,
    broadcastCanonicalState: realtimeService.broadcastCanonicalState,
    persistCanonicalState: realtimeService.persistCanonicalState,
    simulationTickIntervalMs: options.simulationTickIntervalMs || 250,
  });

  const executeMutation = createMutationExecutor({
    idempotencyStore,
    logger,
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
    const recoveredRemainingSeconds = resolveRecoveredRemainingSeconds(
      restoredState,
      options.now ? options.now() : Date.now()
    );

    if (recoveredRemainingSeconds > 0) {
      const resumedTimer = timerService.resume({
        remainingSeconds: recoveredRemainingSeconds,
      });
      raceStore.syncTimer(resumedTimer);
    } else {
      raceStore.finishRace({ reason: "timer_elapsed" });
      raceStore.syncTimer({ remainingSeconds: 0, endsAt: null });
      logger.info("race.timer_elapsed_during_restart", {
        state: raceStore.getSnapshot().state,
      });
    }
  }

  if (raceStore.getSnapshot().simulation?.active) {
    simulationLoop.ensureSimulationLoop();
  }

  realtimeService.persistCanonicalState();

  app.use(express.json({ limit: "64kb" }));
  app.use(express.static(staticDir, { index: false }));

  registerApiRoutes({
    app,
    env: { ...env, raceDurationSeconds },
    logger,
    raceStore,
    staffRoutes,
    verifyStaffKey,
    executeMutation,
    frontDeskOrRaceControlAuth,
    raceControlAuth,
    lapTrackerAuth,
    timerService,
    ensureSimulationLoop: simulationLoop.ensureSimulationLoop,
    stopSimulationLoop: simulationLoop.stopSimulationLoop,
    buildRaceSnapshotPayload: realtimeService.buildRaceSnapshotPayload,
    broadcastCanonicalState: realtimeService.broadcastCanonicalState,
    persistCanonicalState: realtimeService.persistCanonicalState,
    normalizeLockedSnapshotContext,
    setLockedSnapshotContext: (value) => {
      lockedSnapshotContext = value;
    },
  });

  registerRaceSocketHandlers({
    io,
    env,
    logger,
    raceDurationSeconds,
    staffRoutes,
    emitCanonicalState: realtimeService.emitCanonicalState,
    verifyStaffKey,
  });

  registerSpaRoutes({
    app,
    spaRoutes,
    staticDir,
  });

  server.on("close", () => {
    timerService.stop();
    simulationLoop.stopSimulationLoop();
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

module.exports = {
  createApp,
};
