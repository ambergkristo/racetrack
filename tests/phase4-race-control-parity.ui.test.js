const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("./helpers/testHarness");

function buildSnapshot(overrides = {}) {
  return {
    serverTime: "2026-03-26T12:00:00.000Z",
    state: "FINISHED",
    stateLabel: "Finished",
    stateDescription: "Finish has been called. Post-finish laps are still accepted until lock.",
    mode: "SAFE",
    flag: "CHECKERED",
    lapEntryAllowed: true,
    resultsFinalized: false,
    raceDurationSeconds: 60,
    remainingSeconds: 0,
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
          lapCount: 4,
          currentLapTimeMs: 41789,
          bestLapTimeMs: 41789,
          lastCrossingTimestampMs: null,
        },
      ],
    },
    currentSessionId: "session-1",
    currentSession: {
      id: "session-1",
      name: "Heat 1",
      racers: [],
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
    lockedSession: null,
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
    sessions: [
      {
        id: "session-1",
        name: "Heat 1",
        racers: [],
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
        lapCount: 4,
        currentLapTimeMs: 41789,
        bestLapTimeMs: 41789,
      },
    ],
    ...overrides,
  };
}

async function renderRoute(pathname, snapshotOverrides = {}) {
  const source = fs.readFileSync(path.join(__dirname, "..", "client", "app.js"), "utf8");
  const appEl = { innerHTML: "" };

  const document = {
    fullscreenEnabled: true,
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

  return appEl.innerHTML;
}

test("finished wording stays aligned between race-control and leader board", async () => {
  const raceControlHtml = await renderRoute("/race-control");
  const leaderBoardHtml = await renderRoute("/leader-board");

  assert.equal(raceControlHtml.includes("Finished"), true);
  assert.equal(
    raceControlHtml.includes("Finish has been called. Post-finish laps are still accepted until lock."),
    true
  );
  assert.equal(leaderBoardHtml.includes("Finished"), true);
  assert.equal(
    leaderBoardHtml.includes("Finish has been called. Post-finish laps are still accepted until lock."),
    true
  );
  assert.equal(leaderBoardHtml.includes('id="fullscreen-btn"'), true);
});

test("locked wording stays aligned between race-control and public state board", async () => {
  const snapshot = {
    state: "LOCKED",
    stateLabel: "Locked",
    stateDescription: "Race is locked. Results are final and lap input is blocked.",
    flag: "LOCKED",
    lapEntryAllowed: false,
    resultsFinalized: true,
    activeSessionId: null,
    activeSession: null,
    lockedSession: {
      id: "session-1",
      name: "Heat 1",
      racers: [],
    },
  };

  const raceControlHtml = await renderRoute("/race-control", snapshot);
  const flagsHtml = await renderRoute("/race-flags", snapshot);

  assert.equal(raceControlHtml.includes("Locked"), true);
  assert.equal(
    raceControlHtml.includes("Race is locked. Results are final and lap input is blocked."),
    true
  );
  assert.equal(flagsHtml.includes('id="fullscreen-btn"'), true);
  assert.equal(flagsHtml.includes("Locked"), true);
  assert.equal(flagsHtml.includes("Heat 1"), true);
});
