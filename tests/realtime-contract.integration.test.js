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
      { name: "Amy", carNumber: "7" },
      {
        "x-staff-route": "/front-desk",
        "x-staff-key": process.env.FRONT_DESK_KEY,
      }
    );
    assert.equal(addRacerResult.response.status, 201);
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

    const lockedSnapshotPromise = waitForEvent(
      socket,
      SOCKET_EVENTS.RACE_SNAPSHOT,
      (payload) => payload.state === "LOCKED"
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
    const lockedSnapshotPayload = await lockedSnapshotPromise;
    assertSchema(raceSnapshotSchema, lockedSnapshotPayload, "race:snapshot (LOCKED)");
    assert.equal(lockedSnapshotPayload.stateLabel, "Locked");
    assert.equal(lockedSnapshotPayload.flag, "LOCKED");
    assert.equal(lockedSnapshotPayload.lapEntryAllowed, false);
    assert.equal(lockedSnapshotPayload.resultsFinalized, true);
    assert.equal(lockedSnapshotPayload.activeSessionId, null);
    assert.equal(lockedSnapshotPayload.activeSession, null);
    assert.equal(lockedSnapshotPayload.currentSessionId, null);
    assert.equal(lockedSnapshotPayload.nextSessionId, nextSessionId);
    assert.deepEqual(lockedSnapshotPayload.queuedSessionIds, [nextSessionId]);
    assert.equal(lockedSnapshotPayload.nextSession?.id, nextSessionId);
    assert.equal(lockedSnapshotPayload.lockedSession?.id, sessionId);
    assert.equal(lockedSnapshotPayload.finalResults?.length, 1);
    assert.equal(lockedSnapshotPayload.finishOrderActive, true);

    assert.equal(unexpectedServerError, null, "server:error was emitted in happy path");
  } finally {
    socket.close();
    delete process.env.RACE_DURATION_SECONDS;
    await new Promise((resolve) => server.close(resolve));
  }
});
