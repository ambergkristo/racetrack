const assert = require("node:assert/strict");
const http = require("http");
const { createApp } = require("../server");
const { test } = require("./helpers/testHarness");

async function requestJson(url, path) {
  return new Promise((resolve, reject) => {
    const request = http.request(`${url}${path}`, { method: "GET" }, (response) => {
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
    });

    request.on("error", reject);
    request.end();
  });
}

function setBaseEnv() {
  process.env.NODE_ENV = "test";
  process.env.STAFF_AUTH_DISABLED = "false";
  process.env.FRONT_DESK_KEY = "front-desk-test-key";
  process.env.RACE_CONTROL_KEY = "race-control-test-key";
  process.env.LAP_LINE_TRACKER_KEY = "lap-line-test-key";
}

test("bootstrap exposes feature flags as disabled by default", async () => {
  setBaseEnv();
  delete process.env.FF_PERSISTENCE;
  delete process.env.FF_MANUAL_CAR_ASSIGNMENT;

  const { server } = createApp();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}`;

  try {
    const bootstrap = await requestJson(url, "/api/bootstrap");
    assert.equal(bootstrap.status, 200);
    assert.deepEqual(bootstrap.json.featureFlags, {
      FF_PERSISTENCE: false,
      FF_MANUAL_CAR_ASSIGNMENT: false,
    });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test("bootstrap exposes enabled upgrade flags when configured", async () => {
  setBaseEnv();
  process.env.FF_PERSISTENCE = "true";
  process.env.FF_MANUAL_CAR_ASSIGNMENT = "true";

  const { server } = createApp();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}`;

  try {
    const bootstrap = await requestJson(url, "/api/bootstrap");
    assert.equal(bootstrap.status, 200);
    assert.deepEqual(bootstrap.json.featureFlags, {
      FF_PERSISTENCE: true,
      FF_MANUAL_CAR_ASSIGNMENT: true,
    });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
