const assert = require("node:assert/strict");
const http = require("http");
const { io: createClient } = require("socket.io-client");
const { createApp } = require("../server");
const {
  SOCKET_EVENTS,
  leaderboardUpdateSchema,
  raceSnapshotSchema,
  raceTickSchema,
  serverHelloSchema,
} = require("../src/socket/contract");
const { test } = require("./helpers/testHarness");

function waitForEvent(socket, event, predicate = () => true, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeoutMs);

    function handler(payload) {
      if (!predicate(payload)) {
        return;
      }

      cleanup();
      resolve(payload);
    }

    function cleanup() {
      clearTimeout(timeout);
      socket.off(event, handler);
    }

    socket.on(event, handler);
  });
}

async function postJson(url, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const request = http.request(
      `${url}${path}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
          ...headers,
        },
      },
      (response) => {
        let raw = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          raw += chunk;
        });
        response.on("end", () => {
          resolve({
            response: { status: response.statusCode },
            json: raw ? JSON.parse(raw) : {},
          });
        });
      }
    );

    request.on("error", reject);
    request.write(payload);
    request.end();
  });
}

function assertSchema(schema, payload, label) {
  const result = schema.safeParse(payload);
  assert.equal(
    result.success,
    true,
    `${label} failed schema validation: ${result.success ? "" : result.error.message}`
  );
}

test("realtime contract validates active M1 lifecycle payloads and chain order", async () => {
  process.env.FRONT_DESK_KEY = "front-desk-test-key";
  process.env.RACE_CONTROL_KEY = "race-control-test-key";
  process.env.LAP_LINE_TRACKER_KEY = "lap-line-test-key";
  process.env.RACE_DURATION_SECONDS = "2";
  process.env.NODE_ENV = "test";

  const { server } = createApp({ tickIntervalMs: 20 });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}`;

  const socket = createClient(url, {
    autoConnect: false,
    auth: { route: "/leader-board" },
    transports: ["websocket"],
    reconnection: false,
  });

  const chain = [];
  for (const eventName of [
    SOCKET_EVENTS.SERVER_HELLO,
    SOCKET_EVENTS.RACE_SNAPSHOT,
    SOCKET_EVENTS.LEADERBOARD_UPDATE,
    SOCKET_EVENTS.RACE_TICK,
  ]) {
    socket.on(eventName, () => {
      chain.push(eventName);
    });
  }

  let unexpectedServerError = null;
  socket.on(SOCKET_EVENTS.SERVER_ERROR, (payload) => {
    unexpectedServerError = payload;
  });

  try {
    const connected = new Promise((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("connect_error", reject);
    });

    const helloPromise = waitForEvent(socket, SOCKET_EVENTS.SERVER_HELLO);
    const initialSnapshotPromise = waitForEvent(
      socket,
      SOCKET_EVENTS.RACE_SNAPSHOT,
      (payload) => payload.state === "IDLE"
    );
    const initialLeaderboardPromise = waitForEvent(
      socket,
      SOCKET_EVENTS.LEADERBOARD_UPDATE,
      (payload) => payload.state === "IDLE"
    );

    socket.connect();
    await connected;

    const helloPayload = await helloPromise;
    const idleSnapshotPayload = await initialSnapshotPromise;
    const idleLeaderboardPayload = await initialLeaderboardPromise;

    assert.deepEqual(chain.slice(0, 3), [
      SOCKET_EVENTS.SERVER_HELLO,
      SOCKET_EVENTS.RACE_SNAPSHOT,
      SOCKET_EVENTS.LEADERBOARD_UPDATE,
    ]);
    assertSchema(serverHelloSchema, helloPayload, "server:hello");
    assertSchema(raceSnapshotSchema, idleSnapshotPayload, "race:snapshot (IDLE)");
    assertSchema(
      leaderboardUpdateSchema,
      idleLeaderboardPayload,
      "leaderboard:update (IDLE)"
    );
    assert.equal(idleSnapshotPayload.stateLabel, "Idle");
    assert.equal(idleSnapshotPayload.flag, "SAFE");
    assert.equal(idleSnapshotPayload.lapEntryAllowed, false);
    assert.equal(idleSnapshotPayload.resultsFinalized, false);
    assert.equal(idleSnapshotPayload.currentSessionId, null);
    assert.equal(idleSnapshotPayload.nextSessionId, null);
    assert.deepEqual(idleSnapshotPayload.queuedSessionIds, []);
    assert.equal(idleSnapshotPayload.nextSession, null);
    assert.equal(idleSnapshotPayload.lockedSession, null);
    assert.equal(idleSnapshotPayload.finalResults, null);
    assert.equal(idleSnapshotPayload.finishOrderActive, false);
    assert.equal(idleLeaderboardPayload.flag, "SAFE");
    assert.equal(idleLeaderboardPayload.lapEntryAllowed, false);
    assert.equal(idleLeaderboardPayload.finishOrderActive, false);

    const createSessionResult = await postJson(
      url,
      "/api/sessions",
      { name: "Heat 1" },
      {
        "x-staff-route": "/front-desk",
        "x-staff-key": process.env.FRONT_DESK_KEY,
      }
    );
    assert.equal(createSessionResult.response.status, 201);
    const sessionId = createSessionResult.json.session.id;

    const addRacerResult = await postJson(
      url,
      `/api/sessions/${sessionId}/racers`,
      { name: "Amy" },
      {
        "x-staff-route": "/front-desk",
        "x-staff-key": process.env.FRONT_DESK_KEY,
      }
    );
    assert.equal(addRacerResult.response.status, 201);
    assert.equal(addRacerResult.json.racer.carNumber, "1");
    const racerId = addRacerResult.json.racer.id;
    const createNextSessionResult = await postJson(
      url,
      "/api/sessions",
      { name: "Heat 2" },
      {
        "x-staff-route": "/front-desk",
        "x-staff-key": process.env.FRONT_DESK_KEY,
      }
    );
    assert.equal(createNextSessionResult.response.status, 201);
    const nextSessionId = createNextSessionResult.json.session.id;

    const runningSnapshotPromise = waitForEvent(
      socket,
      SOCKET_EVENTS.RACE_SNAPSHOT,
      (payload) => payload.state === "RUNNING"
    );
    const startResult = await postJson(
      url,
      "/api/race/start",
      {},
      {
        "x-staff-route": "/race-control",
        "x-staff-key": process.env.RACE_CONTROL_KEY,
      }
    );
    assert.equal(startResult.response.status, 200);
    const runningSnapshotPayload = await runningSnapshotPromise;
    assertSchema(raceSnapshotSchema, runningSnapshotPayload, "race:snapshot (RUNNING)");
    assert.equal(runningSnapshotPayload.stateLabel, "Running");
    assert.equal(runningSnapshotPayload.flag, "SAFE");
    assert.equal(runningSnapshotPayload.lapEntryAllowed, true);
    assert.equal(runningSnapshotPayload.resultsFinalized, false);
    assert.equal(runningSnapshotPayload.activeSessionId, sessionId);
    assert.equal(runningSnapshotPayload.currentSessionId, sessionId);
    assert.equal(runningSnapshotPayload.nextSessionId, nextSessionId);
    assert.deepEqual(runningSnapshotPayload.queuedSessionIds, [nextSessionId]);
    assert.equal(runningSnapshotPayload.nextSession?.id, nextSessionId);
    assert.equal(runningSnapshotPayload.lockedSession, null);
    assert.equal(runningSnapshotPayload.finalResults, null);
    assert.equal(runningSnapshotPayload.finishOrderActive, false);

    const lapLeaderboardPromise = waitForEvent(
      socket,
      SOCKET_EVENTS.LEADERBOARD_UPDATE,
      (payload) =>
        payload.leaderboard.length > 0 && payload.leaderboard[0].lapCount >= 1
    );
    const lapResult = await postJson(
      url,
      "/api/laps/crossing",
      { racerId },
      {
        "x-staff-route": "/lap-line-tracker",
        "x-staff-key": process.env.LAP_LINE_TRACKER_KEY,
      }
    );
    assert.equal(lapResult.response.status, 200);
    const lapLeaderboardPayload = await lapLeaderboardPromise;
    assertSchema(
      leaderboardUpdateSchema,
      lapLeaderboardPayload,
      "leaderboard:update (lap crossing)"
    );
    assert.equal(lapLeaderboardPayload.flag, "SAFE");
    assert.equal(lapLeaderboardPayload.lapEntryAllowed, true);

    const tickPayload = await waitForEvent(
      socket,
      SOCKET_EVENTS.RACE_TICK,
      (payload) => payload.state === "RUNNING"
    );
    assertSchema(raceTickSchema, tickPayload, "race:tick (RUNNING)");
    assert.equal(tickPayload.flag, "SAFE");
    assert.equal(tickPayload.lapEntryAllowed, true);

    const finishedSnapshotPromise = waitForEvent(
      socket,
      SOCKET_EVENTS.RACE_SNAPSHOT,
      (payload) => payload.state === "FINISHED"
    );
    const finishResult = await postJson(
      url,
      "/api/race/finish",
      {},
      {
        "x-staff-route": "/race-control",
        "x-staff-key": process.env.RACE_CONTROL_KEY,
      }
    );
    assert.equal(finishResult.response.status, 200);
    const finishedSnapshotPayload = await finishedSnapshotPromise;
    assertSchema(raceSnapshotSchema, finishedSnapshotPayload, "race:snapshot (FINISHED)");
    assert.equal(finishedSnapshotPayload.stateLabel, "Finished");
    assert.equal(finishedSnapshotPayload.flag, "CHECKERED");
    assert.equal(finishedSnapshotPayload.lapEntryAllowed, true);
    assert.equal(finishedSnapshotPayload.resultsFinalized, false);
    assert.equal(finishedSnapshotPayload.activeSessionId, sessionId);
    assert.equal(finishedSnapshotPayload.currentSessionId, sessionId);
    assert.equal(finishedSnapshotPayload.nextSessionId, nextSessionId);
    assert.deepEqual(finishedSnapshotPayload.queuedSessionIds, [nextSessionId]);
    assert.equal(finishedSnapshotPayload.nextSession?.id, nextSessionId);
    assert.equal(finishedSnapshotPayload.lockedSession, null);
    assert.equal(finishedSnapshotPayload.finalResults?.length, 1);
    assert.equal(finishedSnapshotPayload.finishOrderActive, true);

    const stagedSnapshotPromise = waitForEvent(
      socket,
      SOCKET_EVENTS.RACE_SNAPSHOT,
      (payload) => payload.state === "STAGING" && payload.activeSessionId === nextSessionId
    );
    const lockResult = await postJson(
      url,
      "/api/race/lock",
      {},
      {
        "x-staff-route": "/race-control",
        "x-staff-key": process.env.RACE_CONTROL_KEY,
      }
    );
    assert.equal(lockResult.response.status, 200);
    const stagedSnapshotPayload = await stagedSnapshotPromise;
    assertSchema(raceSnapshotSchema, stagedSnapshotPayload, "race:snapshot (STAGING after lock)");
    assert.equal(stagedSnapshotPayload.stateLabel, "Staging");
    assert.equal(stagedSnapshotPayload.flag, "SAFE");
    assert.equal(stagedSnapshotPayload.lapEntryAllowed, false);
    assert.equal(stagedSnapshotPayload.resultsFinalized, true);
    assert.equal(stagedSnapshotPayload.activeSessionId, nextSessionId);
    assert.equal(stagedSnapshotPayload.activeSession?.id, nextSessionId);
    assert.equal(stagedSnapshotPayload.currentSessionId, nextSessionId);
    assert.equal(stagedSnapshotPayload.nextSessionId, null);
    assert.deepEqual(stagedSnapshotPayload.queuedSessionIds, []);
    assert.equal(stagedSnapshotPayload.nextSession, null);
    assert.equal(stagedSnapshotPayload.lockedSession?.id, sessionId);
    assert.equal(stagedSnapshotPayload.finalResults?.length, 1);
    assert.equal(stagedSnapshotPayload.finishOrderActive, true);

    const restartSnapshotPromise = waitForEvent(
      socket,
      SOCKET_EVENTS.RACE_SNAPSHOT,
      (payload) => payload.state === "RUNNING" && payload.activeSessionId === nextSessionId
    );
    const restartResult = await postJson(
      url,
      "/api/race/start",
      {},
      {
        "x-staff-route": "/race-control",
        "x-staff-key": process.env.RACE_CONTROL_KEY,
      }
    );
    assert.equal(restartResult.response.status, 200);
    const restartSnapshotPayload = await restartSnapshotPromise;
    assert.equal(restartSnapshotPayload.state, "RUNNING");
    assert.equal(restartSnapshotPayload.activeSessionId, nextSessionId);
    assert.equal(restartSnapshotPayload.lockedSession, null);
    assert.equal(restartSnapshotPayload.finalResults, null);

    assert.equal(unexpectedServerError, null, "server:error was emitted in happy path");
  } finally {
    socket.close();
    delete process.env.RACE_DURATION_SECONDS;
    await new Promise((resolve) => server.close(resolve));
  }
});

test("simulation mode runs through the canonical websocket truth layer", async () => {
  process.env.FRONT_DESK_KEY = "front-desk-test-key";
  process.env.RACE_CONTROL_KEY = "race-control-test-key";
  process.env.LAP_LINE_TRACKER_KEY = "lap-line-test-key";
  process.env.RACE_DURATION_SECONDS = "20";
  process.env.NODE_ENV = "test";

  const { server } = createApp({
    tickIntervalMs: 20,
    simulationTickIntervalMs: 20,
    simulationConfig: {
      baselineLapMsMin: 40,
      baselineLapMsMax: 40,
      jitterMsMin: 0,
      jitterMsMax: 0,
      minLapDurationMs: 1,
      pitLaunchDurationMsMin: 20,
      pitLaunchDurationMsMax: 20,
      pitLaunchReleaseGapMs: 0,
      pitReturnDurationMsMin: 20,
      pitReturnDurationMsMax: 20,
      pitReturnReleaseGapMs: 10,
      targetLapCount: 3,
      maxDurationMs: 5_000,
    },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}`;

  const socket = createClient(url, {
    autoConnect: false,
    auth: { route: "/leader-board" },
    transports: ["websocket"],
    reconnection: false,
  });

  try {
    const connected = new Promise((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("connect_error", reject);
    });
    const initialSnapshotPromise = waitForEvent(
      socket,
      SOCKET_EVENTS.RACE_SNAPSHOT,
      (payload) => payload.state === "IDLE"
    );
    socket.connect();
    await connected;

    await initialSnapshotPromise;

    const sessionResult = await postJson(
      url,
      "/api/sessions",
      { name: "Sim Heat" },
      {
        "x-staff-route": "/front-desk",
        "x-staff-key": process.env.FRONT_DESK_KEY,
      }
    );
    assert.equal(sessionResult.response.status, 201);
    const sessionId = sessionResult.json.session.id;

    const addRacerOne = await postJson(
      url,
      `/api/sessions/${sessionId}/racers`,
      { name: "Amy", carNumber: "7" },
      {
        "x-staff-route": "/front-desk",
        "x-staff-key": process.env.FRONT_DESK_KEY,
      }
    );
    assert.equal(addRacerOne.response.status, 201);

    const addRacerTwo = await postJson(
      url,
      `/api/sessions/${sessionId}/racers`,
      { name: "Ben", carNumber: "8" },
      {
        "x-staff-route": "/front-desk",
        "x-staff-key": process.env.FRONT_DESK_KEY,
      }
    );
    assert.equal(addRacerTwo.response.status, 201);

    const nextSessionResult = await postJson(
      url,
      "/api/sessions",
      { name: "Next Heat" },
      {
        "x-staff-route": "/front-desk",
        "x-staff-key": process.env.FRONT_DESK_KEY,
      }
    );
    assert.equal(nextSessionResult.response.status, 201);
    const nextSessionId = nextSessionResult.json.session.id;

    const simulationActiveSnapshotPromise = waitForEvent(
      socket,
      SOCKET_EVENTS.RACE_SNAPSHOT,
      (payload) => payload.state === "RUNNING" && payload.simulation?.active === true
    );
    const simulateResult = await postJson(
      url,
      "/api/race/simulate",
      {},
      {
        "x-staff-route": "/lap-line-tracker",
        "x-staff-key": process.env.LAP_LINE_TRACKER_KEY,
      }
    );
    assert.equal(simulateResult.response.status, 200);

    const simulationActiveSnapshot = await simulationActiveSnapshotPromise;
    assertSchema(raceSnapshotSchema, simulationActiveSnapshot, "race:snapshot (simulation active)");
    assert.equal(simulationActiveSnapshot.simulation.active, true);
    assert.equal(simulationActiveSnapshot.simulation.status, "ACTIVE");
    assert.equal(simulationActiveSnapshot.simulation.phase, "SAFE_RUN");
    assert.equal(simulationActiveSnapshot.simulation.racers.length, 2);
    assert.equal(
      simulationActiveSnapshot.simulation.racers.every(
        (racer) =>
          racer.lane === "PIT" &&
          racer.lapIndex === 0 &&
          racer.timedLapStarted === false &&
          racer.crossingCount === 0 &&
          racer.carNumber !== null
      ),
      true
    );

    const blockedManualLap = await postJson(
      url,
      "/api/laps/crossing",
      { racerId: addRacerOne.json.racer.id },
      {
        "x-staff-route": "/lap-line-tracker",
        "x-staff-key": process.env.LAP_LINE_TRACKER_KEY,
      }
    );
    assert.equal(blockedManualLap.response.status, 409);

    const checkeredSnapshot = await waitForEvent(
      socket,
      SOCKET_EVENTS.RACE_SNAPSHOT,
      (payload) =>
        payload.state === "FINISHED" &&
        payload.flag === "CHECKERED" &&
        payload.simulation?.active === true
    );
    assertSchema(raceSnapshotSchema, checkeredSnapshot, "race:snapshot (simulation checkered)");
    assert.equal(
      ["CHECKERED", "PIT_RETURN"].includes(checkeredSnapshot.simulation.phase),
      true
    );

    const stagedSnapshot = await waitForEvent(
      socket,
      SOCKET_EVENTS.RACE_SNAPSHOT,
      (payload) =>
        payload.state === "STAGING" &&
        payload.simulation?.active === false &&
        payload.finishOrderActive === true &&
        payload.activeSessionId === nextSessionId
    );
    assertSchema(raceSnapshotSchema, stagedSnapshot, "race:snapshot (simulation staged)");
    assert.equal(stagedSnapshot.flag, "SAFE");
    assert.equal(stagedSnapshot.simulation.status, "COMPLETED");
    assert.equal(stagedSnapshot.simulation.phase, "COMPLETED");
    assert.equal(stagedSnapshot.simulation.completionReason, "pit_return_complete");
    assert.equal(stagedSnapshot.simulation.hardCapReached, false);
    assert.equal(stagedSnapshot.lockedSession?.id, sessionId);
    assert.equal(stagedSnapshot.activeSessionId, nextSessionId);
    assert.equal(
      stagedSnapshot.finalResults[0].bestLapTimeMs <= stagedSnapshot.finalResults[1].bestLapTimeMs,
      true
    );
    assert.deepEqual(
      stagedSnapshot.finalResults.map((entry) => entry.finishPlace).sort((left, right) => left - right),
      [1, 2]
    );
    assert.equal(stagedSnapshot.simulation.racers.every((racer) => racer.carNumber !== null), true);
  } finally {
    socket.close();
    delete process.env.RACE_DURATION_SECONDS;
    await new Promise((resolve) => server.close(resolve));
  }
});
