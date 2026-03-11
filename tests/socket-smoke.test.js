const test = require("node:test");
const assert = require("node:assert/strict");
const { io: createClient } = require("socket.io-client");
const { createApp } = require("../server");
const {
  SOCKET_EVENTS,
  leaderboardUpdateSchema,
  raceSnapshotSchema,
  raceTickSchema,
} = require("../src/socket/contract");

function waitForEvent(socket, event, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeoutMs);

    socket.once(event, (payload) => {
      clearTimeout(timeout);
      resolve(payload);
    });
  });
}

test("socket handshake + M1 public feed emits validated realtime payloads", async () => {
  process.env.FRONT_DESK_KEY = "front-desk-test-key";
  process.env.RACE_CONTROL_KEY = "race-control-test-key";
  process.env.LAP_LINE_TRACKER_KEY = "lap-line-test-key";
  process.env.NODE_ENV = "test";

  const { server } = createApp();
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
    const firstHelloPromise = waitForEvent(socket, SOCKET_EVENTS.SERVER_HELLO);
    const snapshotPromise = waitForEvent(socket, SOCKET_EVENTS.RACE_SNAPSHOT);
    const tickPromise = waitForEvent(socket, SOCKET_EVENTS.RACE_TICK);
    const leaderboardPromise = waitForEvent(socket, SOCKET_EVENTS.LEADERBOARD_UPDATE);
    socket.connect();
    await connected;

    const firstHello = await firstHelloPromise;
    assert.equal(firstHello.version, "m1");
    assert.equal(firstHello.route, "/leader-board");
    assert.ok(firstHello.serverTime);

    const snapshot = await snapshotPromise;
    assert.deepEqual(raceSnapshotSchema.parse(snapshot), snapshot);
    assert.equal(snapshot.currentRace.racers.length, 6);

    const tick = await tickPromise;
    assert.deepEqual(raceTickSchema.parse(tick), tick);
    assert.equal(tick.raceNumber, snapshot.currentRace.number);

    const leaderboard = await leaderboardPromise;
    assert.deepEqual(leaderboardUpdateSchema.parse(leaderboard), leaderboard);
    assert.equal(leaderboard.entries.length, 6);

    socket.emit(SOCKET_EVENTS.CLIENT_HELLO, {});
    const serverError = await waitForEvent(socket, SOCKET_EVENTS.SERVER_ERROR);
    assert.equal(serverError.code, "INVALID_CLIENT_HELLO");

    socket.emit(SOCKET_EVENTS.CLIENT_HELLO, {
      clientId: "smoke-client",
      role: "public",
      route: "/leader-board",
    });
    const echoedHello = await waitForEvent(socket, SOCKET_EVENTS.SERVER_HELLO);
    assert.equal(echoedHello.echo.route, "/leader-board");
    assert.equal(echoedHello.echo.clientId, "smoke-client");
  } finally {
    socket.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
