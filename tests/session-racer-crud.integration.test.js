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

test("session and racer CRUD stay live against the canonical backend", async () => {
  process.env.FRONT_DESK_KEY = "front-desk-test-key";
  process.env.RACE_CONTROL_KEY = "race-control-test-key";
  process.env.LAP_LINE_TRACKER_KEY = "lap-line-test-key";
  process.env.NODE_ENV = "test";

  const { server } = createApp();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}`;

  try {
    const createPrimary = await requestJson(
      url,
      "/api/sessions",
      "POST",
      { name: "Heat 1" },
      frontDeskHeaders()
    );
    assert.equal(createPrimary.status, 201);

    const createQueued = await requestJson(
      url,
      "/api/sessions",
      "POST",
      { name: "Heat 2" },
      frontDeskHeaders()
    );
    assert.equal(createQueued.status, 201);
    const queuedSessionId = createQueued.json.session.id;

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
