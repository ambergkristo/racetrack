const {
  createSessionSchema,
  updateSessionSchema,
  createRacerSchema,
  updateRacerSchema,
  updateSessionCarAssignmentsSchema,
  resetSessionCarAssignmentsSchema,
  selectSessionSchema,
  raceModeSchema,
  lapCrossingSchema,
  simulateRaceSchema,
} = require("../http/schemas");
const { parseBody } = require("../http/request");

function registerApiRoutes({
  app,
  env,
  logger,
  raceStore,
  staffRoutes,
  verifyStaffKey,
  executeMutation,
  frontDeskOrRaceControlAuth,
  raceControlAuth,
  lapTrackerAuth,
  timerService,
  ensureSimulationLoop,
  stopSimulationLoop,
  buildRaceSnapshotPayload,
  broadcastCanonicalState,
  persistCanonicalState,
  normalizeLockedSnapshotContext,
  setLockedSnapshotContext,
}) {
  app.get("/healthz", (_req, res) => {
    res.status(200).json({
      status: "ok",
      raceDurationSeconds: env.raceDurationSeconds,
      raceState: raceStore.getSnapshot().state,
      nodeEnv: process.env.NODE_ENV || "development",
    });
  });

  app.get("/api/bootstrap", (_req, res) => {
    res.status(200).json({
      raceDurationSeconds: env.raceDurationSeconds,
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

  app.post("/api/sessions/:sessionId/racers", frontDeskOrRaceControlAuth, (req, res) =>
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

  app.patch("/api/sessions/:sessionId/racers/:racerId", frontDeskOrRaceControlAuth, (req, res) =>
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

  app.delete("/api/sessions/:sessionId/racers/:racerId", frontDeskOrRaceControlAuth, (req, res) =>
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

  app.put("/api/sessions/:sessionId/car-assignments", frontDeskOrRaceControlAuth, (req, res) =>
    executeMutation(req, res, async () => {
      const { assignments } = parseBody(updateSessionCarAssignmentsSchema, req);
      const session = raceStore.updateSessionCarAssignments(req.params.sessionId, assignments);
      broadcastCanonicalState("session_car_assignments_updated");
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
    "/api/sessions/:sessionId/car-assignments/reset",
    frontDeskOrRaceControlAuth,
    (req, res) =>
      executeMutation(req, res, async () => {
        parseBody(resetSessionCarAssignmentsSchema, req);
        const session = raceStore.resetSessionCarAssignments(req.params.sessionId);
        broadcastCanonicalState("session_car_assignments_reset");
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

  app.post("/api/race/start", raceControlAuth, (req, res) =>
    executeMutation(req, res, async () => {
      setLockedSnapshotContext(normalizeLockedSnapshotContext());
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

  app.post("/api/race/simulate", lapTrackerAuth, (req, res) =>
    executeMutation(req, res, async () => {
      parseBody(simulateRaceSchema, req);
      setLockedSnapshotContext(normalizeLockedSnapshotContext());
      const session = raceStore.startSimulation();
      const timerState = timerService.start();
      raceStore.syncTimer(timerState);
      ensureSimulationLoop();
      broadcastCanonicalState("simulation_started");
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
      if (raceStore.getSnapshot().simulation?.active) {
        ensureSimulationLoop();
      }
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
      stopSimulationLoop();
      const preLockSnapshot = raceStore.getSnapshot();
      const session = raceStore.lockRace();
      setLockedSnapshotContext(
        normalizeLockedSnapshotContext({
          lockedSession: session,
          finalResults: preLockSnapshot.leaderboard,
        })
      );
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
}

module.exports = {
  registerApiRoutes,
};
