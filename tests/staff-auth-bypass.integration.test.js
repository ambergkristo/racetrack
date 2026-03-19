const assert = require("node:assert/strict");
const http = require("http");
const { io: createClient } = require("socket.io-client");
const { createApp } = require("../server");
const { test } = require("./helpers/testHarness");

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

function setDefaultEnv() {
  process.env.NODE_ENV = "test";
  process.env.FRONT_DESK_KEY = "front-desk-test-key";
  process.env.RACE_CONTROL_KEY = "race-control-test-key";
  process.env.LAP_LINE_TRACKER_KEY = "lap-line-test-key";
}

test("staff auth stays required by default", async () => {
  setDefaultEnv();
  process.env.STAFF_AUTH_DISABLED = "false";

  const { server } = createApp();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}`;

  const socket = createClient(url, {
    autoConnect: false,
    auth: { route: "/front-desk" },
    transports: ["websocket"],
    reconnection: false,
  });

  try {
    const mutation = await requestJson(
      url,
      "/api/sessions",
      "POST",
      { name: "Heat 1" },
      { "x-staff-route": "/front-desk" }
    );
    assert.equal(mutation.status, 401);
    assert.equal(mutation.json.code, "STAFF_AUTH_REQUIRED");

    const verify = await requestJson(url, "/api/auth/verify", "POST", {
      route: "/front-desk",
    });
    assert.equal(verify.status, 401);
    assert.equal(verify.json.code, "INVALID_KEY");

    const authError = await new Promise((resolve, reject) => {
      socket.once("connect", () => reject(new Error("socket unexpectedly connected")));
      socket.once("connect_error", resolve);
      socket.connect();
    });
    assert.equal(authError.message, "AUTH_INVALID");
  } finally {
    socket.close();
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test("staff auth bypass can be enabled for demo routes", async () => {
  process.env.NODE_ENV = "test";
  process.env.STAFF_AUTH_DISABLED = "true";
  delete process.env.FRONT_DESK_KEY;
  delete process.env.RACE_CONTROL_KEY;
  delete process.env.LAP_LINE_TRACKER_KEY;

  const { server } = createApp();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}`;

  const socket = createClient(url, {
    autoConnect: false,
    auth: { route: "/front-desk" },
    transports: ["websocket"],
    reconnection: false,
  });

  try {
    const bootstrap = await requestJson(url, "/api/bootstrap", "GET");
    assert.equal(bootstrap.status, 200);
    assert.equal(bootstrap.json.staffAuthDisabled, true);

    const verify = await requestJson(url, "/api/auth/verify", "POST", {
      route: "/front-desk",
    });
    assert.equal(verify.status, 200);
    assert.equal(verify.json.bypassed, true);

    const mutation = await requestJson(
      url,
      "/api/sessions",
      "POST",
      { name: "Heat 1" },
      { "x-staff-route": "/front-desk" }
    );
    assert.equal(mutation.status, 201);

    await new Promise((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("connect_error", reject);
      socket.connect();
    });
    assert.equal(socket.connected, true);
  } finally {
    socket.close();
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
