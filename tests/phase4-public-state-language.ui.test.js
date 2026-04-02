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
      racers: [],
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

test("leader-board shows the live flag semantics alongside state", async () => {
  const html = await renderRoute("/leader-board", {
    snapshot: {
      state: "FINISHED",
      flag: "CHECKERED",
      lapEntryAllowed: true,
      remainingSeconds: 0,
    },
  });

  assert.equal(html.includes("Flag"), true);
  assert.equal(html.includes("Checkered"), true);
  assert.equal(
    html.includes("Finish has been called. Post-finish laps are still accepted until lock."),
    true
  );
});

test("race-flags stays pure while leader-board keeps locked wording", async () => {
  const snapshot = {
    state: "LOCKED",
    flag: "LOCKED",
    lapEntryAllowed: false,
    remainingSeconds: 0,
    activeSessionId: null,
    activeSession: null,
    lockedSession: {
      id: "session-1",
      name: "Heat 1",
      racers: [],
    },
    finalResults: [
      {
        position: 1,
        racerId: "racer-1",
        name: "Alex",
        carNumber: "7",
        lapCount: 4,
        currentLapTimeMs: 41789,
        bestLapTimeMs: 41789,
      },
    ],
  };

  const leaderBoardHtml = await renderRoute("/leader-board", { snapshot });
  const flagsHtml = await renderRoute("/race-flags", { snapshot });

  assert.equal(
    leaderBoardHtml.includes("Race is locked. Results are final and lap input is blocked."),
    true
  );
  assert.equal(flagsHtml.includes("flag-panel-standalone"), true);
  assert.equal(flagsHtml.includes("LOCKED"), false);
  assert.equal(flagsHtml.includes("Locked"), false);
  assert.equal(flagsHtml.includes("Heat 1"), false);
  assert.equal(flagsHtml.includes("Race is locked. Results are final and lap input is blocked."), false);
});
