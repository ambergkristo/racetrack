const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("./helpers/testHarness");

function buildSnapshot(overrides = {}) {
  return {
    serverTime: "2026-03-29T12:00:00.000Z",
    state: "RUNNING",
    mode: "SAFE",
    flag: "SAFE",
    lapEntryAllowed: true,
    raceDurationSeconds: 60,
    remainingSeconds: 42,
    endsAt: "2026-03-29T12:01:00.000Z",
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
    nextSessionId: "session-2",
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
    queuedSessionIds: ["session-2"],
    queuedSessions: [
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
    lockedSession: null,
    finalResults: null,
    simulation: {
      status: "IDLE",
      active: false,
      phase: "IDLE",
      sessionId: null,
      startedAtMs: null,
      endedAtMs: null,
      maxDurationMs: null,
      targetLapCount: null,
      hardCapReached: false,
      completionReason: null,
      racers: [],
    },
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
        staffAuthDisabled: false,
        serverTime: "2026-03-29T12:00:00.000Z",
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

test("next-race keeps public lineup language and avoids queue or manual-assignment leakage", async () => {
  const html = await renderRoute("/next-race");

  assert.equal(html.includes("Heat 1"), true);
  assert.equal(html.includes("Heat 2"), true);
  assert.equal(html.includes("Blair"), true);
  assert.equal(html.includes("Next lineup waiting to take the track."), true);
  assert.equal(html.includes("queued lineup"), false);
  assert.equal(html.includes("Queue is empty"), false);
  assert.equal(html.includes("queue the next session"), false);
  assert.equal(html.includes("Manual assignment"), false);
});

test("next-race empty state stays public-facing when no next lineup is staged", async () => {
  const html = await renderRoute("/next-race", {
    snapshot: {
      nextSessionId: null,
      nextSession: null,
      queuedSessionIds: [],
      queuedSessions: [],
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
      ],
    },
  });

  assert.equal(html.includes("Next lineup not ready"), true);
  assert.equal(html.includes("Front desk has not staged the next lineup yet."), true);
  assert.equal(html.includes("Queue is empty"), false);
  assert.equal(html.includes("Add and queue the next session from front desk."), false);
});

test("next-race shows pit-return guidance while simulation is routing cars off track", async () => {
  const html = await renderRoute("/next-race", {
    snapshot: {
      state: "FINISHED",
      flag: "CHECKERED",
      lapEntryAllowed: true,
      remainingSeconds: 0,
      simulation: {
        status: "ACTIVE",
        active: true,
        phase: "PIT_RETURN",
        sessionId: "session-1",
        startedAtMs: 1000,
        endedAtMs: null,
        maxDurationMs: 120000,
        targetLapCount: 5,
        hardCapReached: false,
        completionReason: null,
        racers: [],
      },
      finalResults: [
        {
          position: 1,
          racerId: "racer-1",
          name: "Alex",
          carNumber: "7",
          lapCount: 5,
          currentLapTimeMs: 21999,
          bestLapTimeMs: 21444,
          finishPlace: 1,
        },
      ],
      leaderboard: [
        {
          position: 1,
          racerId: "racer-1",
          name: "Alex",
          carNumber: "7",
          lapCount: 5,
          currentLapTimeMs: 21999,
          bestLapTimeMs: 21444,
          finishPlace: 1,
        },
      ],
    },
  });

  assert.equal(html.includes("Return to pit lane"), true);
  assert.equal(html.includes("Cars are peeling into the pit lane before the session fully locks."), true);
  assert.equal(html.includes("Final order during pit return"), true);
});

test("next-race renders all eight current and next racers without truncating the roster", async () => {
  const currentRacers = Array.from({ length: 8 }, (_unused, index) => ({
    id: `current-${index + 1}`,
    name: `Current ${index + 1}`,
    carNumber: String(index + 1),
    lapCount: 0,
    currentLapTimeMs: null,
    bestLapTimeMs: null,
    lastCrossingTimestampMs: null,
  }));
  const nextRacers = Array.from({ length: 8 }, (_unused, index) => ({
    id: `next-${index + 1}`,
    name: `Next ${index + 1}`,
    carNumber: String(index + 1),
    lapCount: 0,
    currentLapTimeMs: null,
    bestLapTimeMs: null,
    lastCrossingTimestampMs: null,
  }));

  const html = await renderRoute("/next-race", {
    snapshot: {
      activeSession: {
        id: "session-1",
        name: "Heat 1",
        racers: currentRacers,
      },
      nextSessionId: "session-2",
      nextSession: {
        id: "session-2",
        name: "Heat 2",
        racers: nextRacers,
      },
      queuedSessionIds: ["session-2"],
      queuedSessions: [
        {
          id: "session-2",
          name: "Heat 2",
          racers: nextRacers,
        },
      ],
      sessions: [
        {
          id: "session-1",
          name: "Heat 1",
          racers: currentRacers,
        },
        {
          id: "session-2",
          name: "Heat 2",
          racers: nextRacers,
        },
      ],
    },
  });

  const rosterCount = (html.match(/class="roster-pill"/g) || []).length;

  assert.equal(html.includes("Current Racers"), true);
  assert.equal(html.includes("Next Racers"), true);
  assert.equal(html.includes(">8<"), true);
  assert.equal(rosterCount, 16);
  assert.equal(html.includes("Current 8"), true);
  assert.equal(html.includes("Next 8"), true);
  assert.equal(html.includes("Car 8"), true);
  assert.equal(html.includes("next-race-roster-grid"), true);
});
