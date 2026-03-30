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

test("session and racer CRUD stay live against the canonical backend", async () => {
  process.env.FRONT_DESK_KEY = "front-desk-test-key";
  process.env.RACE_CONTROL_KEY = "race-control-test-key";
  process.env.LAP_LINE_TRACKER_KEY = "lap-line-test-key";
  delete process.env.FF_MANUAL_CAR_ASSIGNMENT;
  process.env.NODE_ENV = "test";

  const { server } = createApp();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}`;

  try {
    const bootstrap = await requestJson(url, "/api/bootstrap", "GET");
    assert.equal(bootstrap.status, 200);
    assert.equal(bootstrap.json.featureFlags.FF_MANUAL_CAR_ASSIGNMENT, false);

    const createPrimary = await requestJson(
      url,
      "/api/sessions",
      "POST",
      { name: "Heat 1" },
      frontDeskHeaders()
    );
    assert.equal(createPrimary.status, 201);
    assert.equal(createPrimary.json.raceSnapshot.currentSessionId, createPrimary.json.session.id);
    assert.equal(createPrimary.json.raceSnapshot.nextSessionId, null);
    assert.deepEqual(createPrimary.json.raceSnapshot.queuedSessionIds, []);

    const createQueued = await requestJson(
      url,
      "/api/sessions",
      "POST",
      { name: "Heat 2" },
      frontDeskHeaders()
    );
    assert.equal(createQueued.status, 201);
    const queuedSessionId = createQueued.json.session.id;
    const primarySessionId = createPrimary.json.session.id;
    assert.equal(createQueued.json.raceSnapshot.currentSessionId, primarySessionId);
    assert.equal(createQueued.json.raceSnapshot.nextSessionId, queuedSessionId);
    assert.deepEqual(createQueued.json.raceSnapshot.queuedSessionIds, [queuedSessionId]);

    const updateSession = await requestJson(
      url,
      `/api/sessions/${queuedSessionId}`,
      "PATCH",
      { name: "Heat 2 Updated" },
      frontDeskHeaders()
    );
    assert.equal(updateSession.status, 200);
    assert.equal(updateSession.json.session.name, "Heat 2 Updated");

    const selectSession = await requestJson(
      url,
      "/api/race/session/select",
      "POST",
      { sessionId: queuedSessionId },
      frontDeskHeaders()
    );
    assert.equal(selectSession.status, 200);
    assert.equal(selectSession.json.raceSnapshot.activeSessionId, queuedSessionId);
    assert.equal(selectSession.json.raceSnapshot.currentSessionId, queuedSessionId);
    assert.equal(selectSession.json.raceSnapshot.nextSessionId, primarySessionId);
    assert.deepEqual(selectSession.json.raceSnapshot.queuedSessionIds, [primarySessionId]);

    const addRacer = await requestJson(
      url,
      `/api/sessions/${queuedSessionId}/racers`,
      "POST",
      { name: "Amy", carNumber: "7" },
      frontDeskHeaders()
    );
    assert.equal(addRacer.status, 201);
    const racerId = addRacer.json.racer.id;

    const duplicateRacer = await requestJson(
      url,
      `/api/sessions/${queuedSessionId}/racers`,
      "POST",
      { name: "Amy", carNumber: "8" },
      frontDeskHeaders()
    );
    assert.equal(duplicateRacer.status, 409);
    assert.equal(duplicateRacer.json.code, "DUPLICATE_RACER_NAME");

    const duplicateCar = await requestJson(
      url,
      `/api/sessions/${queuedSessionId}/racers`,
      "POST",
      { name: "Ben", carNumber: "7" },
      frontDeskHeaders()
    );
    assert.equal(duplicateCar.status, 409);
    assert.equal(duplicateCar.json.code, "DUPLICATE_CAR_NUMBER");

    const updateRacer = await requestJson(
      url,
      `/api/sessions/${queuedSessionId}/racers/${racerId}`,
      "PATCH",
      { name: "Amy Prime", carNumber: "17" },
      frontDeskHeaders()
    );
    assert.equal(updateRacer.status, 200);
    assert.equal(updateRacer.json.racer.name, "Amy Prime");
    assert.equal(updateRacer.json.racer.carNumber, "17");

    const secondRacer = await requestJson(
      url,
      `/api/sessions/${queuedSessionId}/racers`,
      "POST",
      { name: "Blake", carNumber: "22" },
      frontDeskHeaders()
    );
    assert.equal(secondRacer.status, 201);

    const duplicateCarUpdate = await requestJson(
      url,
      `/api/sessions/${queuedSessionId}/racers/${secondRacer.json.racer.id}`,
      "PATCH",
      { carNumber: "17" },
      frontDeskHeaders()
    );
    assert.equal(duplicateCarUpdate.status, 409);
    assert.equal(duplicateCarUpdate.json.code, "DUPLICATE_CAR_NUMBER");

    const deleteRacer = await requestJson(
      url,
      `/api/sessions/${queuedSessionId}/racers/${racerId}`,
      "DELETE",
      undefined,
      frontDeskHeaders()
    );
    assert.equal(deleteRacer.status, 200);
    assert.equal(deleteRacer.json.racer.id, racerId);

    const deleteSession = await requestJson(
      url,
      `/api/sessions/${queuedSessionId}`,
      "DELETE",
      undefined,
      frontDeskHeaders()
    );
    assert.equal(deleteSession.status, 200);
    assert.equal(deleteSession.json.session.id, queuedSessionId);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("queue truth and session guards stay deterministic for front-desk workflow", async () => {
  process.env.FRONT_DESK_KEY = "front-desk-test-key";
  process.env.RACE_CONTROL_KEY = "race-control-test-key";
  process.env.LAP_LINE_TRACKER_KEY = "lap-line-test-key";
  delete process.env.FF_MANUAL_CAR_ASSIGNMENT;
  process.env.NODE_ENV = "test";

  const { server } = createApp();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}`;

  try {
    const heat1 = await requestJson(
      url,
      "/api/sessions",
      "POST",
      { name: "Heat 1" },
      frontDeskHeaders()
    );
    const heat2 = await requestJson(
      url,
      "/api/sessions",
      "POST",
      { name: "Heat 2" },
      frontDeskHeaders()
    );
    const heat3 = await requestJson(
      url,
      "/api/sessions",
      "POST",
      { name: "Heat 3" },
      frontDeskHeaders()
    );
    const heat1Id = heat1.json.session.id;
    const heat2Id = heat2.json.session.id;
    const heat3Id = heat3.json.session.id;

    const selectHeat2 = await requestJson(
      url,
      "/api/race/session/select",
      "POST",
      { sessionId: heat2Id },
      frontDeskHeaders()
    );
    assert.equal(selectHeat2.status, 200);
    assert.equal(selectHeat2.json.raceSnapshot.currentSessionId, heat2Id);
    assert.equal(selectHeat2.json.raceSnapshot.nextSessionId, heat1Id);
    assert.deepEqual(selectHeat2.json.raceSnapshot.queuedSessionIds, [heat1Id, heat3Id]);

    const deleteQueued = await requestJson(
      url,
      `/api/sessions/${heat1Id}`,
      "DELETE",
      undefined,
      frontDeskHeaders()
    );
    assert.equal(deleteQueued.status, 200);
    assert.equal(deleteQueued.json.raceSnapshot.currentSessionId, heat2Id);
    assert.equal(deleteQueued.json.raceSnapshot.nextSessionId, heat3Id);
    assert.deepEqual(deleteQueued.json.raceSnapshot.queuedSessionIds, [heat3Id]);

    const addRacer = await requestJson(
      url,
      `/api/sessions/${heat2Id}/racers`,
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

    const blockedEdit = await requestJson(
      url,
      `/api/sessions/${heat2Id}`,
      "PATCH",
      { name: "Heat 2 Updated" },
      frontDeskHeaders()
    );
    assert.equal(blockedEdit.status, 409);
    assert.equal(blockedEdit.json.code, "SESSION_EDIT_FORBIDDEN");

    const blockedDelete = await requestJson(
      url,
      `/api/sessions/${heat2Id}`,
      "DELETE",
      undefined,
      frontDeskHeaders()
    );
    assert.equal(blockedDelete.status, 409);
    assert.equal(blockedDelete.json.code, "SESSION_DELETE_FORBIDDEN");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("manual car assignment flag does not change queue ordering truth", async () => {
  process.env.FRONT_DESK_KEY = "front-desk-test-key";
  process.env.RACE_CONTROL_KEY = "race-control-test-key";
  process.env.LAP_LINE_TRACKER_KEY = "lap-line-test-key";
  process.env.FF_MANUAL_CAR_ASSIGNMENT = "true";
  process.env.NODE_ENV = "test";

  const { server } = createApp();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}`;

  try {
    const bootstrap = await requestJson(url, "/api/bootstrap", "GET");
    assert.equal(bootstrap.status, 200);
    assert.equal(bootstrap.json.featureFlags.FF_MANUAL_CAR_ASSIGNMENT, true);

    await requestJson(
      url,
      "/api/sessions",
      "POST",
      { name: "Heat 1" },
      frontDeskHeaders()
    );
    const heat2 = await requestJson(
      url,
      "/api/sessions",
      "POST",
      { name: "Heat 2" },
      frontDeskHeaders()
    );
    const heat2Id = heat2.json.session.id;
    const beforeAssignment = heat2.json.raceSnapshot;

    const addedRacer = await requestJson(
      url,
      `/api/sessions/${heat2Id}/racers`,
      "POST",
      { name: "Blake", carNumber: "11" },
      frontDeskHeaders()
    );
    const racerId = addedRacer.json.racer.id;

    const updatedRacer = await requestJson(
      url,
      `/api/sessions/${heat2Id}/racers/${racerId}`,
      "PATCH",
      { carNumber: "22" },
      frontDeskHeaders()
    );
    assert.equal(updatedRacer.status, 200);
    assert.equal(updatedRacer.json.raceSnapshot.currentSessionId, beforeAssignment.currentSessionId);
    assert.equal(updatedRacer.json.raceSnapshot.nextSessionId, beforeAssignment.nextSessionId);
    assert.deepEqual(
      updatedRacer.json.raceSnapshot.queuedSessionIds,
      beforeAssignment.queuedSessionIds
    );
  } finally {
    delete process.env.FF_MANUAL_CAR_ASSIGNMENT;
    await new Promise((resolve) => server.close(resolve));
  }
});
