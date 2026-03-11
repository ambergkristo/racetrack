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

test("race flow broadcasts canonical snapshots, timer finish, and lock guards", async () => {
  process.env.FRONT_DESK_KEY = "front-desk-test-key";
  process.env.RACE_CONTROL_KEY = "race-control-test-key";
  process.env.LAP_LINE_TRACKER_KEY = "lap-line-test-key";
  process.env.RACE_DURATION_SECONDS = "1";
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

    const startSnapshotPromise = waitForEvent(
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
    const runningSnapshot = await startSnapshotPromise;
    assert.equal(runningSnapshot.activeSessionId, sessionId);
    assert.equal(runningSnapshot.remainingSeconds, 1);

    const firstLapResult = await postJson(
      url,
      "/api/laps/crossing",
      { racerId },
      {
        "x-staff-route": "/lap-line-tracker",
        "x-staff-key": process.env.LAP_LINE_TRACKER_KEY,
      }
    );
    assert.equal(firstLapResult.response.status, 200);
    assert.equal(firstLapResult.json.racer.lapCount, 1);

    await new Promise((resolve) => setTimeout(resolve, 25));
    const leaderboardPromise = waitForEvent(
      socket,
      SOCKET_EVENTS.LEADERBOARD_UPDATE,
      (payload) =>
        payload.leaderboard.length === 1 &&
        payload.leaderboard[0].lapCount === 2 &&
        payload.leaderboard[0].bestLapTimeMs !== null
    );
    const secondLapResult = await postJson(
      url,
      "/api/laps/crossing",
      { racerId },
      {
        "x-staff-route": "/lap-line-tracker",
        "x-staff-key": process.env.LAP_LINE_TRACKER_KEY,
      }
    );
    assert.equal(secondLapResult.response.status, 200);
    const leaderboardUpdate = await leaderboardPromise;
    assert.equal(leaderboardUpdate.leaderboard[0].position, 1);
    assert.ok(leaderboardUpdate.leaderboard[0].bestLapTimeMs > 0);

    const tickPromise = waitForEvent(
      socket,
      SOCKET_EVENTS.RACE_TICK,
      (payload) => payload.remainingSeconds === 0
    );
    const finishedSnapshotPromise = waitForEvent(
      socket,
      SOCKET_EVENTS.RACE_SNAPSHOT,
      (payload) => payload.state === "FINISHED"
    );
    await tickPromise;
    const finishedSnapshot = await finishedSnapshotPromise;
    assert.equal(finishedSnapshot.remainingSeconds, 0);

    const finishedLapResult = await postJson(
      url,
      "/api/laps/crossing",
      { racerId },
      {
        "x-staff-route": "/lap-line-tracker",
        "x-staff-key": process.env.LAP_LINE_TRACKER_KEY,
      }
    );
    assert.equal(finishedLapResult.response.status, 200);
    assert.equal(finishedLapResult.json.racer.lapCount, 3);

    const lockSnapshotPromise = waitForEvent(
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
    const lockedSnapshot = await lockSnapshotPromise;
    assert.equal(lockedSnapshot.activeSessionId, null);

    const blockedLapResult = await postJson(
      url,
      "/api/laps/crossing",
      { racerId },
      {
        "x-staff-route": "/lap-line-tracker",
        "x-staff-key": process.env.LAP_LINE_TRACKER_KEY,
      }
    );
    assert.equal(blockedLapResult.response.status, 409);
    assert.equal(blockedLapResult.json.code, "LAP_INPUT_BLOCKED");
  } finally {
    socket.close();
    delete process.env.RACE_DURATION_SECONDS;
    await new Promise((resolve) => server.close(resolve));
  }
});
