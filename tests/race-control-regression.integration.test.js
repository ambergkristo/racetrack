const assert = require("node:assert/strict");
const http = require("http");
const { createApp } = require("../server");
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

function lapHeaders() {
  return {
    "x-staff-route": "/lap-line-tracker",
    "x-staff-key": process.env.LAP_LINE_TRACKER_KEY,
  };
}

test("race-control lifecycle guards and mode transitions preserve canonical phase 4 truth", async () => {
  process.env.FRONT_DESK_KEY = "front-desk-test-key";
  process.env.RACE_CONTROL_KEY = "race-control-test-key";
  process.env.LAP_LINE_TRACKER_KEY = "lap-line-test-key";
  process.env.NODE_ENV = "test";

  const { server } = createApp();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}`;

  try {
    const createSession = await requestJson(
      url,
      "/api/sessions",
      "POST",
      { name: "Heat 1" },
      frontDeskHeaders()
    );
    assert.equal(createSession.status, 201);
    const sessionId = createSession.json.session.id;

    const addRacer = await requestJson(
      url,
      `/api/sessions/${sessionId}/racers`,
      "POST",
      { name: "Alex", carNumber: "7" },
      frontDeskHeaders()
    );
    assert.equal(addRacer.status, 201);
    const racerId = addRacer.json.racer.id;

    const blockedModeBeforeStart = await requestJson(
      url,
      "/api/race/mode",
      "POST",
      { mode: "HAZARD_SLOW" },
      raceControlHeaders()
    );
    assert.equal(blockedModeBeforeStart.status, 409);
    assert.equal(blockedModeBeforeStart.json.code, "MODE_CHANGE_BLOCKED");

    const blockedFinishBeforeStart = await requestJson(
      url,
      "/api/race/finish",
      "POST",
      {},
      raceControlHeaders()
    );
    assert.equal(blockedFinishBeforeStart.status, 409);
    assert.equal(blockedFinishBeforeStart.json.code, "FINISH_BLOCKED");

    const blockedLockBeforeFinish = await requestJson(
      url,
      "/api/race/lock",
      "POST",
      {},
      raceControlHeaders()
    );
    assert.equal(blockedLockBeforeFinish.status, 409);
    assert.equal(blockedLockBeforeFinish.json.code, "LOCK_BLOCKED");

    const startRace = await requestJson(
      url,
      "/api/race/start",
      "POST",
      {},
      raceControlHeaders()
    );
    assert.equal(startRace.status, 200);
    assert.equal(startRace.json.raceSnapshot.stateLabel, "Running");
    assert.equal(startRace.json.raceSnapshot.flag, "SAFE");

    const hazardSlow = await requestJson(
      url,
      "/api/race/mode",
      "POST",
      { mode: "HAZARD_SLOW" },
      raceControlHeaders()
    );
    assert.equal(hazardSlow.status, 200);
    assert.equal(hazardSlow.json.raceSnapshot.flag, "HAZARD_SLOW");
    assert.equal(hazardSlow.json.raceSnapshot.stateLabel, "Running");

    const hazardStop = await requestJson(
      url,
      "/api/race/mode",
      "POST",
      { mode: "HAZARD_STOP" },
      raceControlHeaders()
    );
    assert.equal(hazardStop.status, 200);
    assert.equal(hazardStop.json.raceSnapshot.flag, "HAZARD_STOP");

    const safeMode = await requestJson(
      url,
      "/api/race/mode",
      "POST",
      { mode: "SAFE" },
      raceControlHeaders()
    );
    assert.equal(safeMode.status, 200);
    assert.equal(safeMode.json.raceSnapshot.flag, "SAFE");

    const firstLap = await requestJson(
      url,
      "/api/laps/crossing",
      "POST",
      { racerId },
      lapHeaders()
    );
    assert.equal(firstLap.status, 200);
    assert.equal(firstLap.json.racer.lapCount, 1);

    const finishRace = await requestJson(
      url,
      "/api/race/finish",
      "POST",
      {},
      raceControlHeaders()
    );
    assert.equal(finishRace.status, 200);
    assert.equal(finishRace.json.raceSnapshot.stateLabel, "Finished");
    assert.equal(finishRace.json.raceSnapshot.flag, "CHECKERED");
    assert.equal(finishRace.json.raceSnapshot.resultsFinalized, false);
    assert.match(
      finishRace.json.raceSnapshot.stateDescription,
      /post-finish laps are still accepted until lock/i
    );

    const lapAfterFinish = await requestJson(
      url,
      "/api/laps/crossing",
      "POST",
      { racerId },
      lapHeaders()
    );
    assert.equal(lapAfterFinish.status, 200);
    assert.equal(lapAfterFinish.json.racer.lapCount, 2);

    const blockedModeAfterFinish = await requestJson(
      url,
      "/api/race/mode",
      "POST",
      { mode: "HAZARD_SLOW" },
      raceControlHeaders()
    );
    assert.equal(blockedModeAfterFinish.status, 409);
    assert.equal(blockedModeAfterFinish.json.code, "MODE_CHANGE_BLOCKED");

    const duplicateFinish = await requestJson(
      url,
      "/api/race/finish",
      "POST",
      {},
      raceControlHeaders()
    );
    assert.equal(duplicateFinish.status, 409);
    assert.equal(duplicateFinish.json.code, "FINISH_BLOCKED");

    const lockRace = await requestJson(
      url,
      "/api/race/lock",
      "POST",
      {},
      raceControlHeaders()
    );
    assert.equal(lockRace.status, 200);
    assert.equal(lockRace.json.raceSnapshot.stateLabel, "Locked");
    assert.equal(lockRace.json.raceSnapshot.flag, "LOCKED");
    assert.equal(lockRace.json.raceSnapshot.resultsFinalized, true);
    assert.match(
      lockRace.json.raceSnapshot.stateDescription,
      /results are final and lap input is blocked/i
    );

    const blockedLapAfterLock = await requestJson(
      url,
      "/api/laps/crossing",
      "POST",
      { racerId },
      lapHeaders()
    );
    assert.equal(blockedLapAfterLock.status, 409);
    assert.equal(blockedLapAfterLock.json.code, "LAP_INPUT_BLOCKED");

    const duplicateLock = await requestJson(
      url,
      "/api/race/lock",
      "POST",
      {},
      raceControlHeaders()
    );
    assert.equal(duplicateLock.status, 409);
    assert.equal(duplicateLock.json.code, "LOCK_BLOCKED");

    const blockedStartAfterLock = await requestJson(
      url,
      "/api/race/start",
      "POST",
      {},
      raceControlHeaders()
    );
    assert.equal(blockedStartAfterLock.status, 409);
    assert.equal(blockedStartAfterLock.json.code, "START_BLOCKED");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
