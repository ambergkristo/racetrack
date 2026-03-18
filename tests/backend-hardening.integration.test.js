const assert = require("node:assert/strict");
const http = require("http");
const { io: createClient } = require("socket.io-client");
const { createApp } = require("../server");
const { SOCKET_EVENTS } = require("../src/socket/contract");
const { test } = require("./helpers/testHarness");

async function requestJson(url, pathname, method, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? "" : JSON.stringify(body);
    const request = http.request(
      `${url}${pathname}`,
      {
        method,
        headers: {
          ...(payload
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload),
              }
            : {}),
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
            status: response.statusCode,
            json: raw ? JSON.parse(raw) : {},
          });
        });
      }
    );

    request.on("error", reject);
    if (payload) {
      request.write(payload);
    }
    request.end();
  });
}

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

function frontDeskHeaders(extraHeaders = {}) {
  return {
    "x-staff-route": "/front-desk",
    "x-staff-key": process.env.FRONT_DESK_KEY,
    ...extraHeaders,
  };
}

function raceControlHeaders(extraHeaders = {}) {
  return {
    "x-staff-route": "/race-control",
    "x-staff-key": process.env.RACE_CONTROL_KEY,
    ...extraHeaders,
  };
}

function lapTrackerHeaders(extraHeaders = {}) {
  return {
    "x-staff-route": "/lap-line-tracker",
    "x-staff-key": process.env.LAP_LINE_TRACKER_KEY,
    ...extraHeaders,
  };
}

test("mutation retries with the same request identity do not mutate canonical state twice", async () => {
  process.env.FRONT_DESK_KEY = "front-desk-test-key";
  process.env.RACE_CONTROL_KEY = "race-control-test-key";
  process.env.LAP_LINE_TRACKER_KEY = "lap-line-test-key";
  process.env.NODE_ENV = "test";

  const { server } = createApp();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}`;

  try {
    const createSessionHeaders = frontDeskHeaders({
      "Idempotency-Key": "session-create-1",
    });
    const createFirst = await requestJson(
      url,
      "/api/sessions",
      "POST",
      { name: "Heat 1" },
      createSessionHeaders
    );
    const createRetry = await requestJson(
      url,
      "/api/sessions",
      "POST",
      { name: "Heat 1" },
      createSessionHeaders
    );

    assert.equal(createFirst.status, 201);
    assert.equal(createRetry.status, 201);
    assert.equal(createRetry.json.session.id, createFirst.json.session.id);
    assert.equal(createRetry.json.raceSnapshot.sessions.length, 1);

    const sessionId = createFirst.json.session.id;
    const addRacerHeaders = frontDeskHeaders({
      "Idempotency-Key": "racer-add-1",
    });
    const addRacerFirst = await requestJson(
      url,
      `/api/sessions/${sessionId}/racers`,
      "POST",
      { name: "Amy", carNumber: "7" },
      addRacerHeaders
    );
    const addRacerRetry = await requestJson(
      url,
      `/api/sessions/${sessionId}/racers`,
      "POST",
      { name: "Amy", carNumber: "7" },
      addRacerHeaders
    );

    assert.equal(addRacerFirst.status, 201);
    assert.equal(addRacerRetry.status, 201);
    assert.equal(addRacerRetry.json.racer.id, addRacerFirst.json.racer.id);
    assert.equal(addRacerRetry.json.raceSnapshot.activeSession.racers.length, 1);

    const racerId = addRacerFirst.json.racer.id;
    const startHeaders = raceControlHeaders({
      "Idempotency-Key": "race-start-1",
    });
    const startFirst = await requestJson(url, "/api/race/start", "POST", {}, startHeaders);
    const startRetry = await requestJson(url, "/api/race/start", "POST", {}, startHeaders);

    assert.equal(startFirst.status, 200);
    assert.equal(startRetry.status, 200);
    assert.equal(startRetry.json.raceSnapshot.state, "RUNNING");
    assert.equal(startRetry.json.raceSnapshot.activeSessionId, sessionId);

    const lapFirst = await requestJson(
      url,
      "/api/laps/crossing",
      "POST",
      { racerId, requestId: "lap-1" },
      lapTrackerHeaders()
    );
    const lapRetry = await requestJson(
      url,
      "/api/laps/crossing",
      "POST",
      { racerId, requestId: "lap-1" },
      lapTrackerHeaders()
    );
    const lapNext = await requestJson(
      url,
      "/api/laps/crossing",
      "POST",
      { racerId, requestId: "lap-2" },
      lapTrackerHeaders()
    );

    assert.equal(lapFirst.status, 200);
    assert.equal(lapRetry.status, 200);
    assert.equal(lapRetry.json.racer.lapCount, 1);
    assert.equal(lapRetry.json.raceSnapshot.leaderboard[0].lapCount, 1);
    assert.equal(lapNext.status, 200);
    assert.equal(lapNext.json.racer.lapCount, 2);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("reusing an idempotency key for a different mutation fails with a clear conflict code", async () => {
  process.env.FRONT_DESK_KEY = "front-desk-test-key";
  process.env.RACE_CONTROL_KEY = "race-control-test-key";
  process.env.LAP_LINE_TRACKER_KEY = "lap-line-test-key";
  process.env.NODE_ENV = "test";

  const { server } = createApp();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}`;

  try {
    const initialCreate = await requestJson(
      url,
      "/api/sessions",
      "POST",
      { name: "Heat 1" },
      frontDeskHeaders({ "Idempotency-Key": "session-create-conflict" })
    );
    const conflictingRetry = await requestJson(
      url,
      "/api/sessions",
      "POST",
      { name: "Heat 2" },
      frontDeskHeaders({ "Idempotency-Key": "session-create-conflict" })
    );

    assert.equal(initialCreate.status, 201);
    assert.equal(conflictingRetry.status, 409);
    assert.equal(conflictingRetry.json.code, "IDEMPOTENCY_CONFLICT");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("illegal lifecycle operations keep deterministic conflict codes", async () => {
  process.env.FRONT_DESK_KEY = "front-desk-test-key";
  process.env.RACE_CONTROL_KEY = "race-control-test-key";
  process.env.LAP_LINE_TRACKER_KEY = "lap-line-test-key";
  process.env.NODE_ENV = "test";

  const { server } = createApp();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}`;

  try {
    const finishBeforeStart = await requestJson(
      url,
      "/api/race/finish",
      "POST",
      {},
      raceControlHeaders()
    );
    assert.equal(finishBeforeStart.status, 409);
    assert.equal(finishBeforeStart.json.code, "FINISH_BLOCKED");

    const createSession = await requestJson(
      url,
      "/api/sessions",
      "POST",
      { name: "Heat 1" },
      frontDeskHeaders()
    );
    assert.equal(createSession.status, 201);

    const lockBeforeFinish = await requestJson(
      url,
      "/api/race/lock",
      "POST",
      {},
      raceControlHeaders()
    );
    assert.equal(lockBeforeFinish.status, 409);
    assert.equal(lockBeforeFinish.json.code, "LOCK_BLOCKED");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("running clients receive a tick on reconnect and a full state resync after client hello", async () => {
  process.env.FRONT_DESK_KEY = "front-desk-test-key";
  process.env.RACE_CONTROL_KEY = "race-control-test-key";
  process.env.LAP_LINE_TRACKER_KEY = "lap-line-test-key";
  process.env.RACE_DURATION_SECONDS = "3";
  process.env.NODE_ENV = "test";

  const { server } = createApp({ tickIntervalMs: 50 });
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
    const createSession = await requestJson(
      url,
      "/api/sessions",
      "POST",
      { name: "Heat 1" },
      frontDeskHeaders()
    );
    const sessionId = createSession.json.session.id;

    const addRacer = await requestJson(
      url,
      `/api/sessions/${sessionId}/racers`,
      "POST",
      { name: "Amy", carNumber: "7" },
      frontDeskHeaders()
    );
    assert.equal(addRacer.status, 201);

    const startRace = await requestJson(
      url,
      "/api/race/start",
      "POST",
      {},
      raceControlHeaders()
    );
    assert.equal(startRace.status, 200);

    const connected = new Promise((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("connect_error", reject);
    });
    const initialHelloPromise = waitForEvent(socket, SOCKET_EVENTS.SERVER_HELLO);
    const initialSnapshotPromise = waitForEvent(
      socket,
      SOCKET_EVENTS.RACE_SNAPSHOT,
      (payload) => payload.state === "RUNNING"
    );
    const initialLeaderboardPromise = waitForEvent(
      socket,
      SOCKET_EVENTS.LEADERBOARD_UPDATE,
      (payload) => payload.state === "RUNNING"
    );
    const initialTickPromise = waitForEvent(
      socket,
      SOCKET_EVENTS.RACE_TICK,
      (payload) => payload.state === "RUNNING"
    );

    socket.connect();
    await connected;

    const initialHello = await initialHelloPromise;
    const initialSnapshot = await initialSnapshotPromise;
    const initialLeaderboard = await initialLeaderboardPromise;
    const initialTick = await initialTickPromise;

    assert.equal(initialHello.route, "/leader-board");
    assert.equal(initialSnapshot.activeSessionId, sessionId);
    assert.equal(initialLeaderboard.activeSessionId, sessionId);
    assert.equal(initialTick.state, "RUNNING");

    const resyncHelloPromise = waitForEvent(
      socket,
      SOCKET_EVENTS.SERVER_HELLO,
      (payload) => payload.echo?.clientId === "resync-client"
    );
    const resyncSnapshotPromise = waitForEvent(
      socket,
      SOCKET_EVENTS.RACE_SNAPSHOT,
      (payload) => payload.state === "RUNNING"
    );
    const resyncLeaderboardPromise = waitForEvent(
      socket,
      SOCKET_EVENTS.LEADERBOARD_UPDATE,
      (payload) => payload.state === "RUNNING"
    );
    const resyncTickPromise = waitForEvent(
      socket,
      SOCKET_EVENTS.RACE_TICK,
      (payload) => payload.state === "RUNNING"
    );

    socket.emit(SOCKET_EVENTS.CLIENT_HELLO, {
      clientId: "resync-client",
      role: "public",
      route: "/leader-board",
    });

    const resyncHello = await resyncHelloPromise;
    const resyncSnapshot = await resyncSnapshotPromise;
    const resyncLeaderboard = await resyncLeaderboardPromise;
    const resyncTick = await resyncTickPromise;

    assert.equal(resyncHello.echo.clientId, "resync-client");
    assert.equal(resyncSnapshot.activeSessionId, sessionId);
    assert.equal(resyncLeaderboard.activeSessionId, sessionId);
    assert.equal(resyncTick.state, "RUNNING");
  } finally {
    socket.close();
    delete process.env.RACE_DURATION_SECONDS;
    await new Promise((resolve) => server.close(resolve));
  }
});
