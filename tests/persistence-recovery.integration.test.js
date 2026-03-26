const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { createApp } = require("../server");
const { test } = require("./helpers/testHarness");

function requestJson(url, pathname, method, body, headers = {}) {
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

function frontDeskHeaders() {
  return {
    "x-staff-route": "/front-desk",
    "x-staff-key": process.env.FRONT_DESK_KEY,
  };
}

function raceControlHeaders() {
  return {
    "x-staff-route": "/race-control",
    "x-staff-key": process.env.RACE_CONTROL_KEY,
  };
}

function lapTrackerHeaders() {
  return {
    "x-staff-route": "/lap-line-tracker",
    "x-staff-key": process.env.LAP_LINE_TRACKER_KEY,
  };
}

async function startServer(options = {}) {
  const { server } = createApp(options);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    server,
    url: `http://127.0.0.1:${address.port}`,
  };
}

async function stopServer(server) {
  await new Promise((resolve) => server.close(resolve));
}

function createPersistenceFilePath(testName) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "racetrack-persistence-"));
  return path.join(root, `${testName}.json`);
}

function configurePersistenceEnv(filePath, raceDurationSeconds = "5") {
  process.env.FRONT_DESK_KEY = "front-desk-test-key";
  process.env.RACE_CONTROL_KEY = "race-control-test-key";
  process.env.LAP_LINE_TRACKER_KEY = "lap-line-test-key";
  process.env.FF_PERSISTENCE = "true";
  process.env.PERSISTENCE_FILE_PATH = filePath;
  process.env.RACE_DURATION_SECONDS = raceDurationSeconds;
  process.env.NODE_ENV = "test";
}

function resetPersistenceEnv() {
  delete process.env.FF_PERSISTENCE;
  delete process.env.PERSISTENCE_FILE_PATH;
  delete process.env.RACE_DURATION_SECONDS;
}

function normalizeSnapshot(snapshot) {
  const { serverTime, endsAt, ...rest } = snapshot;
  return rest;
}

test("persistence flag off keeps the M2.5 baseline even if a persisted snapshot exists", async () => {
  process.env.FRONT_DESK_KEY = "front-desk-test-key";
  process.env.RACE_CONTROL_KEY = "race-control-test-key";
  process.env.LAP_LINE_TRACKER_KEY = "lap-line-test-key";
  process.env.NODE_ENV = "test";

  const filePath = createPersistenceFilePath("flag-off");
  fs.writeFileSync(
    filePath,
    JSON.stringify(
      {
        version: 1,
        state: {
          raceState: "FINISHED",
          raceMode: "SAFE",
          activeSessionId: "session-1",
          sessions: [
            {
              id: "session-1",
              name: "Heat 1",
              racers: [],
              createdAt: "2026-03-25T00:00:00.000Z",
              updatedAt: "2026-03-25T00:00:00.000Z",
            },
          ],
          remainingSeconds: 0,
          timerEndsAt: null,
          nextSessionId: 2,
          nextRacerId: 1,
        },
      },
      null,
      2
    )
  );
  process.env.PERSISTENCE_FILE_PATH = filePath;

  const { server, url } = await startServer();

  try {
    const raceSnapshot = await requestJson(url, "/api/race", "GET");
    assert.equal(raceSnapshot.status, 200);
    assert.equal(raceSnapshot.json.state, "IDLE");
    assert.equal(raceSnapshot.json.activeSessionId, null);
    assert.deepEqual(raceSnapshot.json.sessions, []);
  } finally {
    delete process.env.PERSISTENCE_FILE_PATH;
    await stopServer(server);
  }
});

test("persistence restores IDLE and STAGING snapshots exactly across restart", async () => {
  const filePath = createPersistenceFilePath("idle-staging");
  configurePersistenceEnv(filePath, "9");

  let firstBoot = await startServer();

  try {
    const idleSnapshot = await requestJson(firstBoot.url, "/api/race", "GET");
    assert.equal(idleSnapshot.status, 200);
    assert.equal(idleSnapshot.json.state, "IDLE");

    await stopServer(firstBoot.server);
    firstBoot = null;

    let secondBoot = await startServer();
    try {
      const restoredIdleSnapshot = await requestJson(secondBoot.url, "/api/race", "GET");
      assert.equal(restoredIdleSnapshot.status, 200);
      assert.deepEqual(
        normalizeSnapshot(restoredIdleSnapshot.json),
        normalizeSnapshot(idleSnapshot.json)
      );
    } finally {
      await stopServer(secondBoot.server);
    }

    const stagingBoot = await startServer();
    try {
      const createdSession = await requestJson(
        stagingBoot.url,
        "/api/sessions",
        "POST",
        { name: "Heat 1" },
        frontDeskHeaders()
      );
      assert.equal(createdSession.status, 201);
      const sessionId = createdSession.json.session.id;

      const createdRacer = await requestJson(
        stagingBoot.url,
        `/api/sessions/${sessionId}/racers`,
        "POST",
        { name: "Amy", carNumber: "7" },
        frontDeskHeaders()
      );
      assert.equal(createdRacer.status, 201);

      const stagingSnapshot = await requestJson(stagingBoot.url, "/api/race", "GET");
      assert.equal(stagingSnapshot.status, 200);
      assert.equal(stagingSnapshot.json.state, "STAGING");

      await stopServer(stagingBoot.server);

      const restoredStagingBoot = await startServer();
      try {
        const restoredStagingSnapshot = await requestJson(
          restoredStagingBoot.url,
          "/api/race",
          "GET"
        );
        assert.equal(restoredStagingSnapshot.status, 200);
        assert.deepEqual(
          normalizeSnapshot(restoredStagingSnapshot.json),
          normalizeSnapshot(stagingSnapshot.json)
        );
      } finally {
        await stopServer(restoredStagingBoot.server);
      }
    } catch (error) {
      await stopServer(stagingBoot.server);
      throw error;
    }
  } finally {
    resetPersistenceEnv();
    if (firstBoot) {
      await stopServer(firstBoot.server);
    }
  }
});

test("persistence restores RUNNING without lap reset or recovery auto-transition", async () => {
  const filePath = createPersistenceFilePath("running");
  configurePersistenceEnv(filePath, "12");

  const firstBoot = await startServer({ tickIntervalMs: 20 });

  try {
    const createdSession = await requestJson(
      firstBoot.url,
      "/api/sessions",
      "POST",
      { name: "Heat 1" },
      frontDeskHeaders()
    );
    const sessionId = createdSession.json.session.id;

    const createdRacer = await requestJson(
      firstBoot.url,
      `/api/sessions/${sessionId}/racers`,
      "POST",
      { name: "Amy", carNumber: "7" },
      frontDeskHeaders()
    );
    const racerId = createdRacer.json.racer.id;
    const queuedSession = await requestJson(
      firstBoot.url,
      "/api/sessions",
      "POST",
      { name: "Heat 2" },
      frontDeskHeaders()
    );
    assert.equal(queuedSession.status, 201);
    const nextSessionId = queuedSession.json.session.id;

    const startedRace = await requestJson(
      firstBoot.url,
      "/api/race/start",
      "POST",
      {},
      raceControlHeaders()
    );
    assert.equal(startedRace.status, 200);

    const firstLap = await requestJson(
      firstBoot.url,
      "/api/laps/crossing",
      "POST",
      { racerId, timestampMs: 1000 },
      lapTrackerHeaders()
    );
    const secondLap = await requestJson(
      firstBoot.url,
      "/api/laps/crossing",
      "POST",
      { racerId, timestampMs: 2100 },
      lapTrackerHeaders()
    );
    assert.equal(firstLap.status, 200);
    assert.equal(secondLap.status, 200);

    const runningSnapshot = await requestJson(firstBoot.url, "/api/race", "GET");
    assert.equal(runningSnapshot.status, 200);
    assert.equal(runningSnapshot.json.state, "RUNNING");
    assert.equal(runningSnapshot.json.activeSession.racers[0].lapCount, 2);

    await stopServer(firstBoot.server);

    const secondBoot = await startServer({ tickIntervalMs: 20 });
    try {
      const restoredSnapshot = await requestJson(secondBoot.url, "/api/race", "GET");
      assert.equal(restoredSnapshot.status, 200);
      assert.equal(restoredSnapshot.json.state, "RUNNING");
      assert.equal(restoredSnapshot.json.activeSessionId, sessionId);
      assert.equal(restoredSnapshot.json.activeSession.racers[0].lapCount, 2);
      assert.equal(restoredSnapshot.json.leaderboard[0].lapCount, 2);
      assert.ok(restoredSnapshot.json.remainingSeconds > 0);
      assert.equal(typeof restoredSnapshot.json.endsAt, "string");

      const finishAfterRecovery = await requestJson(
        secondBoot.url,
        "/api/race/finish",
        "POST",
        {},
        raceControlHeaders()
      );
      assert.equal(finishAfterRecovery.status, 200);
      assert.equal(finishAfterRecovery.json.raceSnapshot.state, "FINISHED");
    } finally {
      await stopServer(secondBoot.server);
    }
  } finally {
    resetPersistenceEnv();
  }
});

test("RUN -> laps -> FINISH -> restart preserves finished state and checkered lap flow", async () => {
  const filePath = createPersistenceFilePath("finished");
  configurePersistenceEnv(filePath, "10");

  const firstBoot = await startServer();

  try {
    const createdSession = await requestJson(
      firstBoot.url,
      "/api/sessions",
      "POST",
      { name: "Heat 1" },
      frontDeskHeaders()
    );
    const sessionId = createdSession.json.session.id;

    const createdRacer = await requestJson(
      firstBoot.url,
      `/api/sessions/${sessionId}/racers`,
      "POST",
      { name: "Amy", carNumber: "7" },
      frontDeskHeaders()
    );
    const racerId = createdRacer.json.racer.id;
    const queuedSession = await requestJson(
      firstBoot.url,
      "/api/sessions",
      "POST",
      { name: "Heat 2" },
      frontDeskHeaders()
    );
    assert.equal(queuedSession.status, 201);
    const nextSessionId = queuedSession.json.session.id;

    await requestJson(firstBoot.url, "/api/race/start", "POST", {}, raceControlHeaders());
    await requestJson(
      firstBoot.url,
      "/api/laps/crossing",
      "POST",
      { racerId, timestampMs: 1000 },
      lapTrackerHeaders()
    );
    await requestJson(
      firstBoot.url,
      "/api/laps/crossing",
      "POST",
      { racerId, timestampMs: 2050 },
      lapTrackerHeaders()
    );

    const finishedRace = await requestJson(
      firstBoot.url,
      "/api/race/finish",
      "POST",
      {},
      raceControlHeaders()
    );
    assert.equal(finishedRace.status, 200);
    assert.equal(finishedRace.json.raceSnapshot.state, "FINISHED");
    assert.equal(finishedRace.json.raceSnapshot.activeSession.racers[0].lapCount, 2);

    await stopServer(firstBoot.server);

    const secondBoot = await startServer();
    try {
      const restoredSnapshot = await requestJson(secondBoot.url, "/api/race", "GET");
      assert.equal(restoredSnapshot.status, 200);
      assert.equal(restoredSnapshot.json.state, "FINISHED");
      assert.equal(restoredSnapshot.json.flag, "CHECKERED");
      assert.equal(restoredSnapshot.json.lapEntryAllowed, true);
      assert.equal(restoredSnapshot.json.activeSessionId, sessionId);
      assert.equal(restoredSnapshot.json.activeSession.racers[0].lapCount, 2);
      assert.equal(restoredSnapshot.json.leaderboard[0].lapCount, 2);
      assert.equal(restoredSnapshot.json.finalResults.length, 1);
      assert.equal(restoredSnapshot.json.remainingSeconds, 0);

      const finishedLap = await requestJson(
        secondBoot.url,
        "/api/laps/crossing",
        "POST",
        { racerId, timestampMs: 3100 },
        lapTrackerHeaders()
      );
      assert.equal(finishedLap.status, 200);
      assert.equal(finishedLap.json.raceSnapshot.state, "FINISHED");
      assert.equal(finishedLap.json.racer.lapCount, 3);
    } finally {
      await stopServer(secondBoot.server);
    }
  } finally {
    resetPersistenceEnv();
  }
});

test("LOCK -> restart preserves locked state exactly", async () => {
  const filePath = createPersistenceFilePath("locked");
  configurePersistenceEnv(filePath, "8");

  const firstBoot = await startServer();

  try {
    const createdSession = await requestJson(
      firstBoot.url,
      "/api/sessions",
      "POST",
      { name: "Heat 1" },
      frontDeskHeaders()
    );
    const sessionId = createdSession.json.session.id;

    const createdRacer = await requestJson(
      firstBoot.url,
      `/api/sessions/${sessionId}/racers`,
      "POST",
      { name: "Amy", carNumber: "7" },
      frontDeskHeaders()
    );
    const racerId = createdRacer.json.racer.id;
    const queuedSession = await requestJson(
      firstBoot.url,
      "/api/sessions",
      "POST",
      { name: "Heat 2" },
      frontDeskHeaders()
    );
    assert.equal(queuedSession.status, 201);
    const nextSessionId = queuedSession.json.session.id;

    await requestJson(firstBoot.url, "/api/race/start", "POST", {}, raceControlHeaders());
    await requestJson(
      firstBoot.url,
      "/api/race/finish",
      "POST",
      {},
      raceControlHeaders()
    );

    const lockedRace = await requestJson(
      firstBoot.url,
      "/api/race/lock",
      "POST",
      {},
      raceControlHeaders()
    );
    assert.equal(lockedRace.status, 200);
    assert.equal(lockedRace.json.raceSnapshot.state, "LOCKED");

    await stopServer(firstBoot.server);

    const secondBoot = await startServer();
    try {
      const restoredSnapshot = await requestJson(secondBoot.url, "/api/race", "GET");
      assert.equal(restoredSnapshot.status, 200);
      assert.equal(restoredSnapshot.json.state, "LOCKED");
      assert.equal(restoredSnapshot.json.flag, "LOCKED");
      assert.equal(restoredSnapshot.json.lapEntryAllowed, false);
      assert.equal(restoredSnapshot.json.activeSessionId, null);
      assert.equal(restoredSnapshot.json.activeSession, null);
      assert.equal(restoredSnapshot.json.nextSession.id, nextSessionId);
      assert.equal(restoredSnapshot.json.lockedSession.id, sessionId);
      assert.equal(restoredSnapshot.json.finalResults.length, 1);
      assert.equal(restoredSnapshot.json.finalResults[0].racerId, racerId);

      const blockedLap = await requestJson(
        secondBoot.url,
        "/api/laps/crossing",
        "POST",
        { racerId },
        lapTrackerHeaders()
      );
      assert.equal(blockedLap.status, 409);
      assert.equal(blockedLap.json.code, "LAP_INPUT_BLOCKED");
    } finally {
      await stopServer(secondBoot.server);
    }
  } finally {
    resetPersistenceEnv();
  }
});
