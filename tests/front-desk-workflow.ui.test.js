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

async function renderFrontDesk(featureFlags = {}) {
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
        raceSnapshot: buildSnapshot(),
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

  assert.equal(html.includes("Front Desk Workflow"), true);
  assert.equal(html.includes("Current / next / queued"), true);
  assert.equal(html.includes("Current"), true);
  assert.equal(html.includes("Next Up"), true);
  assert.equal(html.includes("Queued later"), true);
  assert.equal(html.includes("Heat 2"), true);
  assert.equal(html.includes("Heat 1"), true);
  assert.equal(html.includes("Heat 3"), true);
  assert.equal(html.includes("Alex"), true);
  assert.equal(html.includes("7"), true);
});

test("front-desk keeps manual assignment messaging hidden when the flag is off", async () => {
  const html = await renderFrontDesk();

  assert.equal(html.includes("Manual assignment active"), false);
});

test("front-desk shows manual assignment messaging only when the flag is on", async () => {
  const html = await renderFrontDesk({
    FF_MANUAL_CAR_ASSIGNMENT: true,
  });

  assert.equal(html.includes("Manual assignment active"), true);
  assert.equal(html.includes("FF ON"), true);
});
