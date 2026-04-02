const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("./helpers/testHarness");

function buildSnapshot() {
  const sharedMeta = {
    createdAt: "2026-03-26T10:00:00.000Z",
    updatedAt: "2026-03-26T10:00:00.000Z",
  };
  const alex = {
    id: "racer-2",
    name: "Alex",
    carNumber: "7",
    lapCount: 0,
    currentLapTimeMs: null,
    bestLapTimeMs: null,
    lastCrossingTimestampMs: null,
    ...sharedMeta,
  };

  return {
    serverTime: "2026-03-26T10:00:00.000Z",
    state: "STAGING",
    mode: "SAFE",
    flag: "STAGING",
    lapEntryAllowed: false,
    finishOrderActive: false,
    raceDurationSeconds: 60,
    remainingSeconds: 60,
    endsAt: null,
    activeSessionId: "session-2",
    activeSession: {
      id: "session-2",
      name: "Heat 2",
      racers: [alex],
      ...sharedMeta,
    },
    currentSessionId: "session-2",
    currentSession: {
      id: "session-2",
      name: "Heat 2",
      racers: [alex],
      ...sharedMeta,
    },
    nextSessionId: "session-1",
    nextSession: {
      id: "session-1",
      name: "Heat 1",
      racers: [],
      ...sharedMeta,
    },
    queuedSessionIds: ["session-1", "session-3"],
    queuedSessions: [
      {
        id: "session-1",
        name: "Heat 1",
        racers: [],
        ...sharedMeta,
      },
      {
        id: "session-3",
        name: "Heat 3",
        racers: [],
        ...sharedMeta,
      },
    ],
    lockedSession: null,
    finalResults: null,
    sessions: [
      {
        id: "session-2",
        name: "Heat 2",
        racers: [alex],
        ...sharedMeta,
      },
      {
        id: "session-1",
        name: "Heat 1",
        racers: [],
        ...sharedMeta,
      },
      {
        id: "session-3",
        name: "Heat 3",
        racers: [],
        ...sharedMeta,
      },
    ],
    leaderboard: [],
  };
}

async function renderFrontDesk(featureFlags = {}, snapshotOverrides = {}) {
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
      pathname: "/front-desk",
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
        staffAuthDisabled: true,
        featureFlags: {
          FF_MANUAL_CAR_ASSIGNMENT: false,
          ...featureFlags,
        },
        raceSnapshot: {
          ...buildSnapshot(),
          ...snapshotOverrides,
        },
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

test("front-desk renders current, next, and queued workflow blocks", async () => {
  const html = await renderFrontDesk();

  assert.equal(html.includes("Front Desk Console"), true);
  assert.equal(html.includes("Next Race Setup"), true);
  assert.equal(html.includes("Create Session"), true);
  assert.equal(html.includes("Session Summary"), true);
  assert.equal(html.includes("Saved Sessions"), true);
  assert.equal(html.includes("Control State"), true);
  assert.equal(html.includes("Racer Management"), true);
  assert.equal(html.includes("Current Race"), true);
  assert.equal(html.includes("Registered Racers"), true);
  assert.equal(html.includes("Heat 2"), true);
  assert.equal(html.includes("Heat 1"), true);
  assert.equal(html.includes("Heat 3"), true);
  assert.equal(html.includes("Choose a session to manage"), false);
  assert.equal(html.includes("Queue control"), false);
  assert.equal(html.includes("Next Up"), false);
});

test("front-desk keeps manual assignment messaging hidden when the flag is off", async () => {
  const html = await renderFrontDesk();

  assert.equal(html.includes("Manual assignment active"), false);
});

test("front-desk shows manual assignment messaging only when the flag is on", async () => {
  const html = await renderFrontDesk({
    FF_MANUAL_CAR_ASSIGNMENT: true,
  });

  assert.equal(html.includes("Manual Car Assignment"), true);
  assert.equal(html.includes("Manual assignment active"), false);
  assert.equal(html.includes("FF ON"), false);
});

test("front-desk saved sessions stay visible while racer management follows the selected next session", async () => {
  const makeRacer = (index) => ({
    id: `racer-${index}`,
    name: `Racer ${index}`,
    carNumber: String(index),
    lapCount: 0,
    currentLapTimeMs: null,
    bestLapTimeMs: null,
    lastCrossingTimestampMs: null,
    createdAt: "2026-03-26T10:00:00.000Z",
    updatedAt: "2026-03-26T10:00:00.000Z",
  });
  const currentRacers = Array.from({ length: 5 }, (_unused, index) => makeRacer(index + 1));
  const nextRacers = Array.from({ length: 5 }, (_unused, index) => makeRacer(index + 11));

  const html = await renderFrontDesk(
    {},
    {
      activeSession: {
        id: "session-2",
        name: "Heat 2",
        racers: currentRacers,
        createdAt: "2026-03-26T10:00:00.000Z",
        updatedAt: "2026-03-26T10:00:00.000Z",
      },
      currentSession: {
        id: "session-2",
        name: "Heat 2",
        racers: currentRacers,
        createdAt: "2026-03-26T10:00:00.000Z",
        updatedAt: "2026-03-26T10:00:00.000Z",
      },
      nextSession: {
        id: "session-1",
        name: "Heat 1",
        racers: nextRacers,
        createdAt: "2026-03-26T10:00:00.000Z",
        updatedAt: "2026-03-26T10:00:00.000Z",
      },
    }
  );

  assert.equal(html.includes("Heat 2"), true);
  assert.equal(html.includes("Heat 1"), true);
  assert.equal(html.includes("Saved Sessions"), true);
  assert.equal(html.includes("No racers in the selected session."), true);
  assert.equal(html.includes("Queue is empty"), false);
});
