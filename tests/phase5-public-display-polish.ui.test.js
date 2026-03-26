const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("./helpers/testHarness");

function buildSnapshot(overrides = {}) {
  return {
    serverTime: "2026-03-26T12:00:00.000Z",
    state: "RUNNING",
    mode: "SAFE",
    flag: "SAFE",
    lapEntryAllowed: true,
    raceDurationSeconds: 60,
    remainingSeconds: 42,
    endsAt: "2026-03-26T12:01:00.000Z",
    activeSessionId: "session-1",
    activeSession: {
      id: "session-1",
      name: "Heat 1",
      racers: [
        {
          id: "racer-1",
          name: "Alex",
          carNumber: "7",
          lapCount: 3,
          currentLapTimeMs: 43123,
          bestLapTimeMs: 42888,
          lastCrossingTimestampMs: null,
        },
      ],
    },
    nextSession: {
      id: "session-2",
      name: "Heat 2",
      racers: [
        {
          id: "racer-2",
          name: "Blair",
          carNumber: "12",
          lapCount: 0,
          currentLapTimeMs: null,
          bestLapTimeMs: null,
          lastCrossingTimestampMs: null,
        },
      ],
    },
    lockedSession: null,
    finalResults: null,
    sessions: [
      {
        id: "session-1",
        name: "Heat 1",
        racers: [
          {
            id: "racer-1",
            name: "Alex",
            carNumber: "7",
            lapCount: 3,
            currentLapTimeMs: 43123,
            bestLapTimeMs: 42888,
            lastCrossingTimestampMs: null,
          },
        ],
      },
      {
        id: "session-2",
        name: "Heat 2",
        racers: [
          {
            id: "racer-2",
            name: "Blair",
            carNumber: "12",
            lapCount: 0,
            currentLapTimeMs: null,
            bestLapTimeMs: null,
            lastCrossingTimestampMs: null,
          },
        ],
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

async function renderRoute(pathname, { snapshot } = {}) {
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
        },
        staffAuthDisabled: false,
        serverTime: "2026-03-26T12:00:00.000Z",
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

test("leader-board surfaces countdown, flag, and live lap at a glance", async () => {
  const html = await renderRoute("/leader-board");

  assert.equal(html.includes("Countdown"), true);
  assert.equal(html.includes("Current Lap"), true);
  assert.equal(html.includes("Flag"), true);
  assert.equal(html.includes("00:42"), true);
});

test("next-race shows the queued lineup and post-race pit guidance", async () => {
  const html = await renderRoute("/next-race", {
    snapshot: {
      state: "FINISHED",
      flag: "CHECKERED",
      remainingSeconds: 0,
    },
  });

  assert.equal(html.includes("Drivers return to pit."), true);
  assert.equal(html.includes("Heat 2"), true);
  assert.equal(html.includes("Car 12"), true);
  assert.equal(html.includes("Blair"), true);
});

test("race-countdown keeps timer, session name, and roster together", async () => {
  const html = await renderRoute("/race-countdown");

  assert.equal(html.includes("Heat 1"), true);
  assert.equal(html.includes("00:42"), true);
  assert.equal(html.includes("Car 7"), true);
  assert.equal(html.includes("Alex"), true);
});

test("race-flags stays minimal while keeping the core state meaning", async () => {
  const html = await renderRoute("/race-flags", {
    snapshot: {
      state: "FINISHED",
      flag: "CHECKERED",
      remainingSeconds: 0,
    },
  });

  assert.equal(html.includes("CHECKERED"), true);
  assert.equal(html.includes("Finished"), true);
  assert.equal(html.includes("flag-timer"), false);
  assert.equal(
    html.includes("Finish has been called. Post-finish laps are still accepted until lock."),
    true
  );
});
