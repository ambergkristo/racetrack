const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { createApp } = require("../server");
const { test } = require("./helpers/testHarness");

const FLAG_COMBINATIONS = [
  { persistence: false, manualCarAssignment: false },
  { persistence: false, manualCarAssignment: true },
  { persistence: true, manualCarAssignment: false },
  { persistence: true, manualCarAssignment: true },
];

function comboLabel({ persistence, manualCarAssignment }) {
  return `FF_PERSISTENCE=${persistence ? "ON" : "OFF"}, FF_MANUAL_CAR_ASSIGNMENT=${
    manualCarAssignment ? "ON" : "OFF"
  }`;
}

function createPersistenceFilePath(prefix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "racetrack-m3-matrix-"));
  return {
    root,
    filePath: path.join(root, `${prefix}.json`),
  };
}

function setMatrixEnv(combo, persistenceFilePath) {
  process.env.NODE_ENV = "test";
  process.env.STAFF_AUTH_DISABLED = "false";
  process.env.FRONT_DESK_KEY = "front-desk-test-key";
  process.env.RACE_CONTROL_KEY = "race-control-test-key";
  process.env.LAP_LINE_TRACKER_KEY = "lap-line-test-key";
  process.env.RACE_DURATION_SECONDS = "12";
  process.env.PERSISTENCE_FILE_PATH = persistenceFilePath;
  process.env.FF_PERSISTENCE = combo.persistence ? "true" : "false";
  process.env.FF_MANUAL_CAR_ASSIGNMENT = combo.manualCarAssignment ? "true" : "false";
}

function resetMatrixEnv() {
  delete process.env.FF_PERSISTENCE;
  delete process.env.FF_MANUAL_CAR_ASSIGNMENT;
  delete process.env.PERSISTENCE_FILE_PATH;
  delete process.env.RACE_DURATION_SECONDS;
  delete process.env.STAFF_AUTH_DISABLED;
}

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
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
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

async function createRaceSession(url) {
  const createSessionResult = await requestJson(
    url,
    "/api/sessions",
    "POST",
    { name: "Heat 1" },
    frontDeskHeaders()
  );
  assert.equal(createSessionResult.status, 201);
  assert.equal(createSessionResult.json.raceSnapshot.state, "STAGING");

  const sessionId = createSessionResult.json.session.id;
  const addRacerResult = await requestJson(
    url,
    `/api/sessions/${sessionId}/racers`,
    "POST",
    { name: "Amy", carNumber: "7" },
    frontDeskHeaders()
  );
  assert.equal(addRacerResult.status, 201);

  return {
    sessionId,
    racerId: addRacerResult.json.racer.id,
  };
}

async function assertBootstrapFlags(url, combo) {
  const bootstrapResult = await requestJson(url, "/api/bootstrap", "GET");
  assert.equal(bootstrapResult.status, 200);
  assert.deepEqual(bootstrapResult.json.featureFlags, {
    FF_PERSISTENCE: combo.persistence,
    FF_MANUAL_CAR_ASSIGNMENT: combo.manualCarAssignment,
  });
}

async function validateFinishedRecovery(combo, persistenceFilePath) {
  const firstBoot = await startServer({ tickIntervalMs: 20 });

  try {
    await assertBootstrapFlags(firstBoot.url, combo);
    const { sessionId, racerId } = await createRaceSession(firstBoot.url);

    const startResult = await requestJson(
      firstBoot.url,
      "/api/race/start",
      "POST",
      {},
      raceControlHeaders()
    );
    assert.equal(startResult.status, 200);
    assert.equal(startResult.json.raceSnapshot.state, "RUNNING");
    assert.equal(startResult.json.raceSnapshot.lapEntryAllowed, true);

    const runningLapResult = await requestJson(
      firstBoot.url,
      "/api/laps/crossing",
      "POST",
      { racerId, timestampMs: 1000 },
      lapTrackerHeaders()
    );
    assert.equal(runningLapResult.status, 200);
    assert.equal(runningLapResult.json.racer.lapCount, 1);

    const finishResult = await requestJson(
      firstBoot.url,
      "/api/race/finish",
      "POST",
      {},
      raceControlHeaders()
    );
    assert.equal(finishResult.status, 200);
    assert.equal(finishResult.json.raceSnapshot.state, "FINISHED");
    assert.equal(finishResult.json.raceSnapshot.flag, "CHECKERED");
    assert.equal(finishResult.json.raceSnapshot.lapEntryAllowed, true);

    const finishedLapResult = await requestJson(
      firstBoot.url,
      "/api/laps/crossing",
      "POST",
      { racerId, timestampMs: 2050 },
      lapTrackerHeaders()
    );
    assert.equal(finishedLapResult.status, 200);
    assert.equal(finishedLapResult.json.racer.lapCount, 2);

    await stopServer(firstBoot.server);

    const secondBoot = await startServer({ tickIntervalMs: 20 });
    try {
      await assertBootstrapFlags(secondBoot.url, combo);
      const restoredSnapshot = await requestJson(secondBoot.url, "/api/race", "GET");
      assert.equal(restoredSnapshot.status, 200);

      if (combo.persistence) {
        assert.equal(restoredSnapshot.json.state, "FINISHED");
        assert.equal(restoredSnapshot.json.flag, "CHECKERED");
        assert.equal(restoredSnapshot.json.lapEntryAllowed, true);
        assert.equal(restoredSnapshot.json.activeSessionId, sessionId);
        assert.equal(restoredSnapshot.json.activeSession.racers[0].lapCount, 2);
        assert.equal(restoredSnapshot.json.leaderboard[0].lapCount, 2);
        assert.equal(restoredSnapshot.json.remainingSeconds, 0);
        assert.ok(fs.existsSync(persistenceFilePath));
      } else {
        assert.equal(restoredSnapshot.json.state, "IDLE");
        assert.equal(restoredSnapshot.json.flag, "SAFE");
        assert.equal(restoredSnapshot.json.lapEntryAllowed, false);
        assert.equal(restoredSnapshot.json.activeSessionId, null);
        assert.deepEqual(restoredSnapshot.json.sessions, []);
        assert.deepEqual(restoredSnapshot.json.leaderboard, []);
      }
    } finally {
      await stopServer(secondBoot.server);
    }
  } catch (error) {
    await stopServer(firstBoot.server).catch(() => {});
    throw error;
  }
}

async function validateLockedRecovery(combo) {
  const firstBoot = await startServer();

  try {
    const { sessionId, racerId } = await createRaceSession(firstBoot.url);

    const startResult = await requestJson(
      firstBoot.url,
      "/api/race/start",
      "POST",
      {},
      raceControlHeaders()
    );
    assert.equal(startResult.status, 200);

    const runningLapResult = await requestJson(
      firstBoot.url,
      "/api/laps/crossing",
      "POST",
      { racerId, timestampMs: 1000 },
      lapTrackerHeaders()
    );
    assert.equal(runningLapResult.status, 200);

    const finishResult = await requestJson(
      firstBoot.url,
      "/api/race/finish",
      "POST",
      {},
      raceControlHeaders()
    );
    assert.equal(finishResult.status, 200);
    assert.equal(finishResult.json.raceSnapshot.flag, "CHECKERED");

    const lockResult = await requestJson(
      firstBoot.url,
      "/api/race/lock",
      "POST",
      {},
      raceControlHeaders()
    );
    assert.equal(lockResult.status, 200);
    assert.equal(lockResult.json.raceSnapshot.state, "LOCKED");
    assert.equal(lockResult.json.raceSnapshot.flag, "LOCKED");
    assert.equal(lockResult.json.raceSnapshot.lapEntryAllowed, false);
    assert.equal(lockResult.json.raceSnapshot.lockedSession.id, sessionId);

    const blockedLapResult = await requestJson(
      firstBoot.url,
      "/api/laps/crossing",
      "POST",
      { racerId, timestampMs: 2050 },
      lapTrackerHeaders()
    );
    assert.equal(blockedLapResult.status, 409);
    assert.equal(blockedLapResult.json.code, "LAP_INPUT_BLOCKED");

    await stopServer(firstBoot.server);

    const secondBoot = await startServer();
    try {
      const restoredSnapshot = await requestJson(secondBoot.url, "/api/race", "GET");
      assert.equal(restoredSnapshot.status, 200);

      if (combo.persistence) {
        assert.equal(restoredSnapshot.json.state, "LOCKED");
        assert.equal(restoredSnapshot.json.flag, "LOCKED");
        assert.equal(restoredSnapshot.json.lapEntryAllowed, false);
        assert.equal(restoredSnapshot.json.activeSessionId, null);
        assert.equal(restoredSnapshot.json.lockedSession.id, sessionId);
        assert.equal(restoredSnapshot.json.leaderboard[0].lapCount, 1);

        const blockedRestoredLapResult = await requestJson(
          secondBoot.url,
          "/api/laps/crossing",
          "POST",
          { racerId, timestampMs: 3100 },
          lapTrackerHeaders()
        );
        assert.equal(blockedRestoredLapResult.status, 409);
        assert.equal(blockedRestoredLapResult.json.code, "LAP_INPUT_BLOCKED");
      } else {
        assert.equal(restoredSnapshot.json.state, "IDLE");
        assert.equal(restoredSnapshot.json.flag, "SAFE");
        assert.equal(restoredSnapshot.json.activeSessionId, null);
        assert.deepEqual(restoredSnapshot.json.sessions, []);
      }
    } finally {
      await stopServer(secondBoot.server);
    }
  } catch (error) {
    await stopServer(firstBoot.server).catch(() => {});
    throw error;
  }
}

for (const combo of FLAG_COMBINATIONS) {
  test(`M3 matrix validates lifecycle, CHECKERED, LOCKED, and restart recovery for ${comboLabel(combo)}`, async () => {
    const finishedRecoveryArtifacts = createPersistenceFilePath(
      comboLabel(combo).replace(/[^A-Z0-9]+/gi, "-").toLowerCase()
    );
    const lockedRecoveryArtifacts = createPersistenceFilePath(
      `${comboLabel(combo).replace(/[^A-Z0-9]+/gi, "-").toLowerCase()}-locked`
    );

    try {
      setMatrixEnv(combo, finishedRecoveryArtifacts.filePath);
      await validateFinishedRecovery(combo, finishedRecoveryArtifacts.filePath);
      setMatrixEnv(combo, lockedRecoveryArtifacts.filePath);
      await validateLockedRecovery(combo);
    } finally {
      resetMatrixEnv();
      fs.rmSync(finishedRecoveryArtifacts.root, { recursive: true, force: true });
      fs.rmSync(lockedRecoveryArtifacts.root, { recursive: true, force: true });
    }
  });
}
