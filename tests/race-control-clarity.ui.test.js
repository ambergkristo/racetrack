const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("./helpers/testHarness");

function buildSnapshot(overrides = {}) {
  return {
    serverTime: "2026-03-26T12:00:00.000Z",
    state: "STAGING",
    mode: "SAFE",
    flag: "SAFE",
    lapEntryAllowed: false,
    raceDurationSeconds: 60,
    remainingSeconds: 60,
    endsAt: null,
    activeSessionId: "session-1",
    activeSession: {
      id: "session-1",
      name: "Heat 1",
      racers: [
        {
          id: "racer-1",
          name: "Alex",
          carNumber: "7",
          lapCount: 0,
          currentLapTimeMs: null,
          bestLapTimeMs: null,
          lastCrossingTimestampMs: null,
        },
      ],
    },
    currentSessionId: "session-1",
    currentSession: {
      id: "session-1",
      name: "Heat 1",
      racers: [
        {
          id: "racer-1",
          name: "Alex",
          carNumber: "7",
          lapCount: 0,
          currentLapTimeMs: null,
          bestLapTimeMs: null,
          lastCrossingTimestampMs: null,
        },
      ],
    },
    nextSessionId: "session-2",
    nextSession: {
      id: "session-2",
      name: "Heat 2",
      racers: [],
    },
    queuedSessionIds: ["session-2"],
    queuedSessions: [
      {
        id: "session-2",
        name: "Heat 2",
        racers: [],
      },
    ],
    sessions: [
      {
        id: "session-1",
        name: "Heat 1",
        racers: [
          {
            id: "racer-1",
            name: "Alex",
            carNumber: "7",
            lapCount: 0,
            currentLapTimeMs: null,
            bestLapTimeMs: null,
            lastCrossingTimestampMs: null,
          },
        ],
      },
      {
        id: "session-2",
        name: "Heat 2",
        racers: [],
      },
    ],
    leaderboard: [],
    ...overrides,
  };
}

async function renderRaceControl(snapshotOverrides = {}) {
  const source = fs.readFileSync(path.join(__dirname, "..", "client", "app.js"), "utf8");
  const appEl = { innerHTML: "" };
  const socketHandlers = {};
  const socket = {
    connected: true,
    active: true,
    on(event, handler) {
      socketHandlers[event] = handler;
    },
    emit() {},
    disconnect() {},
    io: {
      on() {},
    },
  };

  const document = {
    fullscreenEnabled: false,
    fullscreenElement: null,
    documentElement: {
      requestFullscreen: async () => {},
    },
    getElementById(id) {
      return id === "app" ? appEl : null;
    },
    querySelectorAll() {
      return [];
    },
    addEventListener() {},
  };

  const window = {
    location: {
      pathname: "/race-control",
      search: "",
    },
    io() {
      return socket;
    },
  };

  const fetch = async () => ({
    async json() {
      return {
        featureFlags: {
          FF_PERSISTENCE: false,
          FF_MANUAL_CAR_ASSIGNMENT: false,
        },
        staffAuthDisabled: true,
        serverTime: "2026-03-26T12:00:00.000Z",
        raceSnapshot: buildSnapshot(snapshotOverrides),
      };
    },
  });

  vm.runInNewContext(source, {
    window,
    document,
    fetch,
    console,
    URLSearchParams,
    setTimeout,
    clearTimeout,
  });

  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  socketHandlers.connect?.();
  socketHandlers["race:snapshot"]?.(buildSnapshot(snapshotOverrides));

  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  return appEl.innerHTML;
}

test("race-control hides mode controls outside RUNNING", async () => {
  const html = await renderRaceControl({
    state: "STAGING",
    lapEntryAllowed: false,
  });

  assert.equal(html.includes("Mode controls hidden"), true);
  assert.equal(html.includes("Modes only during running."), true);
});

test("race-control shows mode buttons while RUNNING", async () => {
  const html = await renderRaceControl({
    state: "RUNNING",
    lapEntryAllowed: true,
  });

  assert.equal(html.includes("Mode controls hidden"), false);
  assert.equal(html.includes("Hazard Slow"), true);
  assert.equal(html.includes("Hazard Stop"), true);
});

test("race-control makes FINISHED state visibly checkered before lock", async () => {
  const html = await renderRaceControl({
    state: "FINISHED",
    flag: "CHECKERED",
    lapEntryAllowed: true,
    remainingSeconds: 0,
  });

  assert.equal(html.includes("Checkered"), true);
  assert.equal(
    html.includes("Finish has been called. Post-finish laps are still accepted until lock."),
    true
  );
  assert.equal(html.includes("Only after finish."), false);
});

test("race-control makes LOCKED finality explicit", async () => {
  const html = await renderRaceControl({
    state: "LOCKED",
    flag: "LOCKED",
    lapEntryAllowed: false,
    remainingSeconds: 0,
  });

  assert.equal(html.includes("Locked"), true);
  assert.equal(
    html.includes("Race is locked. Results are final and lap input is blocked."),
    true
  );
});
