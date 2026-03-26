const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("./helpers/testHarness");

function buildSnapshot(overrides = {}) {
  return {
    serverTime: "2026-03-26T09:00:00.000Z",
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
      name: "Morning Heat",
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
    lockedSession: null,
    sessions: [
      {
        id: "session-1",
        name: "Morning Heat",
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
        name: "Noon Heat",
        racers: [],
      },
    ],
    leaderboard: [
      {
        position: 1,
        racerId: "racer-1",
        name: "Alex",
        carNumber: "7",
        lapCount: 3,
        currentLapTimeMs: 43123,
        bestLapTimeMs: 42888,
      },
    ],
    ...overrides,
  };
}

async function renderRoute(pathname, { featureFlags, snapshot } = {}) {
  const source = fs.readFileSync(path.join(__dirname, "..", "client", "app.js"), "utf8");
  const appEl = { innerHTML: "" };

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
      pathname,
      search: "",
    },
    io() {
      return {
        connected: false,
        on() {},
        emit() {},
        disconnect() {},
        io: {
          on() {},
        },
      };
    },
  };

  const fetch = async () => ({
    async json() {
      return {
        featureFlags: {
          FF_PERSISTENCE: false,
          FF_MANUAL_CAR_ASSIGNMENT: false,
          ...featureFlags,
        },
        staffAuthDisabled: false,
        serverTime: "2026-03-26T09:00:00.000Z",
        raceSnapshot: buildSnapshot(snapshot),
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

  return appEl.innerHTML;
}

test("front-desk renders the one-screen workbench layout", async () => {
  const html = await renderRoute("/front-desk");

  assert.equal(html.includes("Front Desk Workflow"), true);
  assert.equal(html.includes("frontdesk-workflow"), true);
  assert.equal(html.includes("Current / next / queued"), true);
  assert.equal(html.includes("Racer management"), true);
  assert.equal(html.includes("Session Queue"), false);
});

test("race-control renders a single primary control console", async () => {
  const html = await renderRoute("/race-control");

  assert.equal(html.includes("Race Control Console"), true);
  assert.equal(html.includes("race-control-shell"), true);
  assert.equal(html.includes("Flag mode"), true);
  assert.equal(html.includes("Mode Control"), false);
});

test("lap-line-tracker keeps lap entry and tap targets in one console", async () => {
  const html = await renderRoute("/lap-line-tracker", {
    snapshot: {
      state: "RUNNING",
      lapEntryAllowed: true,
      mode: "SAFE",
      flag: "SAFE",
    },
  });

  assert.equal(html.includes("Lap Entry Console"), true);
  assert.equal(html.includes("lap-tracker-shell"), true);
  assert.equal(html.includes("Ready for taps"), true);
  assert.equal(html.includes("Crossing Console"), false);
});
