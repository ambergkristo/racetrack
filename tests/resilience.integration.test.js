const assert = require("node:assert/strict");
const http = require("http");
const { io: createClient } = require("socket.io-client");
const { createApp } = require("../server");
const { SOCKET_EVENTS } = require("../src/socket/contract");
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

async function requestJson(url, path, method, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? "" : JSON.stringify(body);
    const request = http.request(
      `${url}${path}`,
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
            response: { status: response.statusCode },
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

function postJson(url, path, body, headers = {}) {
  return requestJson(url, path, "POST", body, headers);
}

function getJson(url, path, headers = {}) {
  return requestJson(url, path, "GET", undefined, headers);
}

function createMemoryLogger() {
  const entries = [];

  function push(level, event, fields = {}) {
    entries.push({ level, event, ...fields });
  }

  return {
    entries,
    logger: {
      info(event, fields) {
        push("info", event, fields);
      },
      warn(event, fields) {
        push("warn", event, fields);
      },
      error(event, fields) {
        push("error", event, fields);
      },
    },
  };
}

test("reconnect resync returns authoritative snapshot and leaderboard after disconnect", async () => {
  process.env.FRONT_DESK_KEY = "front-desk-test-key";
  process.env.RACE_CONTROL_KEY = "race-control-test-key";
  process.env.LAP_LINE_TRACKER_KEY = "lap-line-test-key";
  process.env.RACE_DURATION_SECONDS = "3";
  process.env.NODE_ENV = "test";

  const { logger, entries } = createMemoryLogger();
  const { server } = createApp({ tickIntervalMs: 20, logger });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}`;

  const socket = createClient(url, {
    autoConnect: false,
    auth: { route: "/leader-board" },
    transports: ["websocket"],
    reconnection: false,
  });

  let reconnectSocket;

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
    assert.equal(lapResult.json.racer.lapCount, 1);

    socket.close();

    reconnectSocket = createClient(url, {
      autoConnect: false,
      auth: { route: "/leader-board" },
      transports: ["websocket"],
      reconnection: false,
    });

    const reconnectChain = [];
    for (const eventName of [
      SOCKET_EVENTS.SERVER_HELLO,
      SOCKET_EVENTS.RACE_SNAPSHOT,
      SOCKET_EVENTS.LEADERBOARD_UPDATE,
    ]) {
      reconnectSocket.on(eventName, () => {
        reconnectChain.push(eventName);
      });
    }

    const reconnectDone = new Promise((resolve, reject) => {
      reconnectSocket.once("connect", resolve);
      reconnectSocket.once("connect_error", reject);
    });

    const runningSnapshotPromise = waitForEvent(
      reconnectSocket,
      SOCKET_EVENTS.RACE_SNAPSHOT,
      (payload) =>
        payload.state === "RUNNING" &&
        payload.activeSessionId === sessionId &&
        payload.activeSession?.racers?.[0]?.lapCount === 1
    );
    const leaderboardPromise = waitForEvent(
      reconnectSocket,
      SOCKET_EVENTS.LEADERBOARD_UPDATE,
      (payload) =>
        payload.state === "RUNNING" &&
        payload.leaderboard.length === 1 &&
        payload.leaderboard[0].racerId === racerId &&
        payload.leaderboard[0].lapCount === 1
    );

    reconnectSocket.connect();
    await reconnectDone;

    const runningSnapshot = await runningSnapshotPromise;
    const leaderboard = await leaderboardPromise;
    assert.deepEqual(reconnectChain.slice(0, 3), [
      SOCKET_EVENTS.SERVER_HELLO,
      SOCKET_EVENTS.RACE_SNAPSHOT,
      SOCKET_EVENTS.LEADERBOARD_UPDATE,
    ]);
    assert.equal(runningSnapshot.activeSessionId, sessionId);
    assert.equal(leaderboard.leaderboard[0].lapCount, 1);

    const connectionEvents = entries.filter((entry) => entry.event === "socket.connected");
    const disconnectEvents = entries.filter((entry) => entry.event === "socket.disconnected");
    const resyncEvents = entries.filter((entry) => entry.event === "socket.resync_emitted");
    assert.ok(connectionEvents.length >= 2);
    assert.ok(disconnectEvents.length >= 1);
    assert.ok(
      resyncEvents.some(
        (entry) =>
          entry.delivery === "socket" &&
          entry.reason === "socket_connected" &&
          entry.state === "RUNNING"
      )
    );
    assert.ok(
      resyncEvents.some(
        (entry) =>
          entry.delivery === "broadcast" &&
          entry.reason === "lap_recorded" &&
          entry.leaderboardSize === 1
      )
    );
  } finally {
    socket.close();
    if (reconnectSocket) {
      reconnectSocket.close();
    }
    delete process.env.RACE_DURATION_SECONDS;
    await new Promise((resolve) => server.close(resolve));
  }
});

test("invalid socket payloads and repeated control actions surface errors without corrupting state", async () => {
  process.env.FRONT_DESK_KEY = "front-desk-test-key";
  process.env.RACE_CONTROL_KEY = "race-control-test-key";
  process.env.LAP_LINE_TRACKER_KEY = "lap-line-test-key";
  process.env.RACE_DURATION_SECONDS = "5";
  process.env.NODE_ENV = "test";

  const { logger, entries } = createMemoryLogger();
  const { server } = createApp({ tickIntervalMs: 20, logger });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}`;

  const socket = createClient(url, {
    autoConnect: false,
    auth: { route: "/leader-board" },
    transports: ["websocket"],
    reconnection: false,
  });

  const invalidSocket = createClient(url, {
    autoConnect: false,
    auth: {},
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

    const authErrorPromise = new Promise((resolve) => {
      invalidSocket.once("connect_error", resolve);
    });
    invalidSocket.connect();
    const authError = await authErrorPromise;
    assert.equal(authError.message, "AUTH_INVALID");

    const wrongKeyStartResult = await postJson(
      url,
      "/api/race/start",
      {},
      {
        "x-staff-route": "/race-control",
        "x-staff-key": "wrong-key",
      }
    );
    assert.equal(wrongKeyStartResult.response.status, 401);
    assert.equal(wrongKeyStartResult.json.code, "INVALID_KEY");

    const finishBeforeStartResult = await postJson(
      url,
      "/api/race/finish",
      {},
      {
        "x-staff-route": "/race-control",
        "x-staff-key": process.env.RACE_CONTROL_KEY,
      }
    );
    assert.equal(finishBeforeStartResult.response.status, 409);
    assert.equal(finishBeforeStartResult.json.code, "FINISH_BLOCKED");

    const lockBeforeFinishResult = await postJson(
      url,
      "/api/race/lock",
      {},
      {
        "x-staff-route": "/race-control",
        "x-staff-key": process.env.RACE_CONTROL_KEY,
      }
    );
    assert.equal(lockBeforeFinishResult.response.status, 409);
    assert.equal(lockBeforeFinishResult.json.code, "LOCK_BLOCKED");

    socket.emit(SOCKET_EVENTS.CLIENT_HELLO, {});
    const invalidPayloadError = await waitForEvent(
      socket,
      SOCKET_EVENTS.SERVER_ERROR,
      (payload) => payload.code === "INVALID_CLIENT_HELLO"
    );
    assert.equal(invalidPayloadError.message, "client:hello payload failed validation.");

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

    const modeBeforeRunningResult = await postJson(
      url,
      "/api/race/mode",
      { mode: "SAFE" },
      {
        "x-staff-route": "/race-control",
        "x-staff-key": process.env.RACE_CONTROL_KEY,
      }
    );
    assert.equal(modeBeforeRunningResult.response.status, 409);
    assert.equal(modeBeforeRunningResult.json.code, "MODE_CHANGE_BLOCKED");

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

    const duplicateStartResult = await postJson(
      url,
      "/api/race/start",
      {},
      {
        "x-staff-route": "/race-control",
        "x-staff-key": process.env.RACE_CONTROL_KEY,
      }
    );
    assert.equal(duplicateStartResult.response.status, 409);
    assert.equal(duplicateStartResult.json.code, "START_BLOCKED");

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

    const duplicateFinishResult = await postJson(
      url,
      "/api/race/finish",
      {},
      {
        "x-staff-route": "/race-control",
        "x-staff-key": process.env.RACE_CONTROL_KEY,
      }
    );
    assert.equal(duplicateFinishResult.response.status, 409);
    assert.equal(duplicateFinishResult.json.code, "FINISH_BLOCKED");

    const finishedState = await getJson(url, "/api/race");
    assert.equal(finishedState.response.status, 200);
    assert.equal(finishedState.json.state, "FINISHED");

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

    const duplicateLockResult = await postJson(
      url,
      "/api/race/lock",
      {},
      {
        "x-staff-route": "/race-control",
        "x-staff-key": process.env.RACE_CONTROL_KEY,
      }
    );
    assert.equal(duplicateLockResult.response.status, 409);
    assert.equal(duplicateLockResult.json.code, "LOCK_BLOCKED");

    const startAfterLockResult = await postJson(
      url,
      "/api/race/start",
      {},
      {
        "x-staff-route": "/race-control",
        "x-staff-key": process.env.RACE_CONTROL_KEY,
      }
    );
    assert.equal(startAfterLockResult.response.status, 409);
    assert.equal(startAfterLockResult.json.code, "START_BLOCKED");

    const lockedState = await getJson(url, "/api/race");
    assert.equal(lockedState.response.status, 200);
    assert.equal(lockedState.json.state, "LOCKED");

    assert.ok(entries.some((entry) => entry.event === "socket.auth_invalid"));
    assert.ok(entries.some((entry) => entry.event === "socket.client_payload_invalid"));
    assert.ok(
      entries.some(
        (entry) => entry.event === "http.staff_auth_failed" && entry.reason === "INVALID_KEY"
      )
    );
    assert.ok(
      entries.some(
        (entry) => entry.event === "http.domain_error" && entry.code === "START_BLOCKED"
      )
    );
    assert.ok(
      entries.some(
        (entry) => entry.event === "http.domain_error" && entry.code === "MODE_CHANGE_BLOCKED"
      )
    );
    assert.ok(
      entries.some(
        (entry) => entry.event === "http.domain_error" && entry.code === "FINISH_BLOCKED"
      )
    );
    assert.ok(
      entries.some(
        (entry) => entry.event === "http.domain_error" && entry.code === "LOCK_BLOCKED"
      )
    );
  } finally {
    socket.close();
    invalidSocket.close();
    delete process.env.RACE_DURATION_SECONDS;
    await new Promise((resolve) => server.close(resolve));
  }
});
