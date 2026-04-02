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

async function renderRoute(pathname, { snapshot, fullscreenEnabled = true } = {}) {
  const source = fs.readFileSync(path.join(__dirname, "..", "client", "app.js"), "utf8");
  const appEl = { innerHTML: "" };

  const document = {
    fullscreenEnabled,
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

test("public routes keep fullscreen affordances on all display screens", async () => {
  const expectations = [
    ["/leader-board", "Timing Tower"],
    ["/next-race", "Race Board"],
    ["/race-countdown", "Race Countdown"],
    ["/race-flags", "Track State Board"],
  ];

  for (const [pathname, routeMarker] of expectations) {
    const html = await renderRoute(pathname);
    assert.equal(html.includes('id="fullscreen-btn"'), true, `${pathname} missing fullscreen button`);
    assert.equal(html.includes("Enter Fullscreen"), true, `${pathname} missing fullscreen label`);
    assert.equal(html.includes("Desktop + tablet ready"), true, `${pathname} missing fullscreen detail`);
    assert.equal(html.includes(routeMarker), true, `${pathname} missing route marker`);
  }
});

test("leader-board uses the public shell and renders eight F1-style timing rows", async () => {
  const leaderboard = Array.from({ length: 8 }, (_unused, index) => ({
    position: index + 1,
    racerId: `racer-${index + 1}`,
    name: `Racer ${index + 1}`,
    carNumber: String(index + 1),
    lapCount: 3,
    currentLapTimeMs: 43000 + index * 120,
    bestLapTimeMs: 42000 + index * 120,
  }));

  const html = await renderRoute("/leader-board", {
    snapshot: {
      leaderboard,
      activeSession: {
        id: "session-1",
        name: "Heat 1",
        racers: leaderboard.map((entry) => ({
          id: entry.racerId,
          name: entry.name,
          carNumber: entry.carNumber,
          lapCount: entry.lapCount,
          currentLapTimeMs: entry.currentLapTimeMs,
          bestLapTimeMs: entry.bestLapTimeMs,
          lastCrossingTimestampMs: null,
        })),
      },
    },
  });

  const rowCount = (html.match(/leaderboard-board-row/g) || []).length;

  assert.equal(rowCount, 8);
  assert.equal(html.includes("public-shell"), true);
  assert.equal(html.includes("public-route-grid"), true);
  assert.equal(html.includes("telemetry-table"), false);
  assert.equal(html.includes("leaderboard-board"), true);
});

test("leader-board keeps fastest-lap order after finish even when finish-place differs", async () => {
  const html = await renderRoute("/leader-board", {
    snapshot: {
      state: "LOCKED",
      flag: "LOCKED",
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
          racerId: "racer-ben",
          name: "Ben",
          carNumber: "12",
          lapCount: 2,
          currentLapTimeMs: 41200,
          bestLapTimeMs: 41200,
          finishPlace: 2,
        },
        {
          position: 2,
          racerId: "racer-amy",
          name: "Amy",
          carNumber: "7",
          lapCount: 2,
          currentLapTimeMs: 42000,
          bestLapTimeMs: 42000,
          finishPlace: 1,
        },
      ],
      leaderboard: [],
    },
  });

  assert.equal(html.includes("1st over the line"), true);
  assert.equal(html.indexOf("Ben") < html.indexOf("Amy"), true);
});

test("staff and public routes reflect the same CHECKERED truth without collapsing the next session", async () => {
  const snapshot = buildSnapshot({
    state: "FINISHED",
    flag: "CHECKERED",
    lapEntryAllowed: true,
    remainingSeconds: 0,
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
  });

  const raceControlHtml = await renderRoute("/race-control", { snapshot });
  const leaderBoardHtml = await renderRoute("/leader-board", { snapshot });
  const nextRaceHtml = await renderRoute("/next-race", { snapshot });

  assert.equal(raceControlHtml.includes("Finished"), true);
  assert.equal(raceControlHtml.includes("End + Lock"), true);
  assert.equal(leaderBoardHtml.includes("Finished"), true);
  assert.equal(
    leaderBoardHtml.includes("Finish has been called. Post-finish laps are still accepted until lock."),
    true
  );
  assert.equal(leaderBoardHtml.includes("Alex"), true);
  assert.equal(nextRaceHtml.includes("Heat 1"), true);
  assert.equal(nextRaceHtml.includes("Heat 2"), true);
  assert.equal(nextRaceHtml.includes("Blair"), true);
});

test("locked truth stays visible on staff and public routes while fullscreen remains available", async () => {
  const snapshot = buildSnapshot({
    state: "LOCKED",
    flag: "LOCKED",
    lapEntryAllowed: false,
    activeSessionId: null,
    activeSession: null,
    lockedSession: {
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
  });

  const lapTrackerHtml = await renderRoute("/lap-line-tracker", { snapshot });
  const flagsHtml = await renderRoute("/race-flags", { snapshot });

  assert.equal(lapTrackerHtml.includes("Session is LOCKED. Lap input is blocked."), true);
  assert.equal(flagsHtml.includes("id=\"fullscreen-btn\""), true);
  assert.equal(flagsHtml.includes("Locked"), true);
  assert.equal(flagsHtml.includes("Heat 1"), true);
  assert.equal(flagsHtml.includes("Race is locked. Results are final and lap input is blocked."), true);
});
