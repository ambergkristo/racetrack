const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createClientAppFetch } = require("./helpers/clientAppFetch");
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

  const fetch = createClientAppFetch({
    bootstrap: {
      featureFlags: {
        FF_PERSISTENCE: false,
        FF_MANUAL_CAR_ASSIGNMENT: false,
      },
      staffAuthDisabled: false,
      serverTime: "2026-03-29T12:00:00.000Z",
      raceSnapshot: buildSnapshot(snapshot),
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

  assert.equal(html.includes("Heat 2"), true);
  assert.equal(html.includes("Blair"), true);
  assert.equal(html.includes("Next session lineup"), true);
  assert.equal(html.includes("Next lineup waiting to take the track."), true);
  assert.equal(html.includes("On track now"), false);
  assert.equal(html.includes("Up next"), false);
  assert.equal(html.includes("queued lineup"), false);
  assert.equal(html.includes("Queue is empty"), false);
  assert.equal(html.includes("queue the next session"), false);
  assert.equal(html.includes("Manual assignment"), false);
  assert.equal(html.includes("Proceed to the paddock"), false);
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

test("next-race keeps the next-session lineup visible before the Safety Official ends the session", async () => {
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

  assert.equal(html.includes("Next session lineup"), true);
  assert.equal(html.includes("Heat 2"), true);
  assert.equal(html.includes("Blair"), true);
  assert.equal(html.includes("Proceed to the paddock"), false);
  assert.equal(html.includes("Final order during pit return"), true);
});

test("next-race switches to the finished session roster with paddock guidance after end session", async () => {
  const html = await renderRoute("/next-race", {
    snapshot: {
      state: "STAGING",
      mode: "HAZARD_STOP",
      flag: "HAZARD_STOP",
      lapEntryAllowed: false,
      finishOrderActive: true,
      activeSessionId: "session-2",
      activeSession: {
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
      currentSessionId: "session-2",
      currentSession: {
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
      nextSessionId: null,
      nextSession: null,
      queuedSessionIds: [],
      queuedSessions: [],
      lockedSession: {
        id: "session-1",
        name: "Heat 1",
        racers: [
          {
            id: "racer-1",
            name: "Alex",
            carNumber: "7",
            lapCount: 5,
            currentLapTimeMs: 21999,
            bestLapTimeMs: 21444,
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
      sessions: [
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
    },
  });

  assert.equal(html.includes("Proceed to paddock"), true);
  assert.equal(html.includes("Proceed to the paddock"), true);
  assert.equal(html.includes("Heat 1"), true);
  assert.equal(html.includes("Alex"), true);
  assert.equal(html.includes("Up next"), true);
  assert.equal(html.includes("Heat 2"), true);
  assert.equal(html.includes("Blair"), true);
  assert.equal(html.includes("Danger"), true);
  assert.equal(html.includes("Who is on track now, and who is up next?"), false);
  assert.equal(html.includes("Information board for the current heat and the next lineup waiting to take the track."), false);
  assert.equal(html.includes("Which finished drivers should proceed to the paddock?"), true);
  assert.equal(
    html.includes("This board now shows the finished session roster while the next lineup is queued for the Safety Official."),
    true
  );
  assert.equal(
    html.includes(
      "Next staged session roster and assigned cars are ready for the Safety Official briefing. Cars start from paddock."
    ),
    true
  );
});

test("next-race keeps paddock guidance and shows an empty staged-session side panel when no next session exists", async () => {
  const html = await renderRoute("/next-race", {
    snapshot: {
      state: "LOCKED",
      mode: "HAZARD_STOP",
      flag: "LOCKED",
      lapEntryAllowed: false,
      finishOrderActive: true,
      activeSessionId: null,
      activeSession: null,
      currentSessionId: null,
      currentSession: null,
      nextSessionId: null,
      nextSession: null,
      queuedSessionIds: [],
      queuedSessions: [],
      lockedSession: {
        id: "session-1",
        name: "Heat 1",
        racers: [
          {
            id: "racer-1",
            name: "Alex",
            carNumber: "7",
            lapCount: 5,
            currentLapTimeMs: 21999,
            bestLapTimeMs: 21444,
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
      sessions: [],
    },
  });

  assert.equal(html.includes("Proceed to paddock"), true);
  assert.equal(html.includes("Proceed to the paddock"), true);
  assert.equal(html.includes("Heat 1"), true);
  assert.equal(html.includes("Alex"), true);
  assert.equal(html.includes("Up next"), true);
  assert.equal(html.includes("No next session staged yet"), true);
  assert.equal(html.includes("Front desk has not staged the next lineup yet."), true);
});

test("next-race keeps paddock panel first and preserves two-column handoff layout styles", async () => {
  const html = await renderRoute("/next-race", {
    snapshot: {
      state: "STAGING",
      mode: "HAZARD_STOP",
      flag: "HAZARD_STOP",
      lapEntryAllowed: false,
      finishOrderActive: true,
      activeSessionId: "session-2",
      activeSession: {
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
      currentSessionId: "session-2",
      currentSession: {
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
      nextSessionId: null,
      nextSession: null,
      queuedSessionIds: [],
      queuedSessions: [],
      lockedSession: {
        id: "session-1",
        name: "Heat 1",
        racers: [
          {
            id: "racer-1",
            name: "Alex",
            carNumber: "7",
            lapCount: 5,
            currentLapTimeMs: 21999,
            bestLapTimeMs: 21444,
            lastCrossingTimestampMs: null,
          },
        ],
      },
      sessions: [
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
    },
  });
  const css = fs.readFileSync(path.join(__dirname, "..", "client", "app.css"), "utf8");

  assert.equal(html.includes('class="session-board-grid next-race-session-board-grid is-paddock-handoff"'), true);
  assert.equal(html.indexOf("Proceed to paddock") < html.indexOf("Up next"), true);
  assert.match(
    css,
    /\.route-next-race \.next-race-session-board-grid\.is-paddock-handoff \{[\s\S]*grid-template-columns: minmax\(0, 1\.2fr\) minmax\(320px, 0\.8fr\);/
  );
  assert.match(
    css,
    /@media \(max-width: 1180px\) \{[\s\S]*\.session-board-grid,[\s\S]*grid-template-columns: 1fr;/
  );
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

  assert.equal(html.includes("Next session lineup"), true);
  assert.equal(html.includes(">8<"), true);
  assert.equal(rosterCount, 8);
  assert.equal(html.includes("Next 8"), true);
  assert.equal(html.includes("Current 8"), false);
  assert.equal(html.includes("Car 8"), true);
  assert.equal(html.includes("next-race-roster-grid"), true);
});

test("next-race locked handoff keeps both eight-racer panels intact with staged-session briefing copy", async () => {
  const finishedRacers = Array.from({ length: 8 }, (_unused, index) => ({
    id: `finished-${index + 1}`,
    name: `Finished ${index + 1}`,
    carNumber: String(index + 1),
    lapCount: 5 - Math.floor(index / 2),
    currentLapTimeMs: 22000 + index * 111,
    bestLapTimeMs: 21400 + index * 101,
    lastCrossingTimestampMs: null,
  }));
  const stagedRacers = Array.from({ length: 8 }, (_unused, index) => ({
    id: `staged-${index + 1}`,
    name: `Staged ${index + 1}`,
    carNumber: String(index + 11),
    lapCount: 0,
    currentLapTimeMs: null,
    bestLapTimeMs: null,
    lastCrossingTimestampMs: null,
  }));

  const html = await renderRoute("/next-race", {
    snapshot: {
      state: "LOCKED",
      mode: "HAZARD_STOP",
      flag: "LOCKED",
      lapEntryAllowed: false,
      finishOrderActive: true,
      activeSessionId: "session-2",
      activeSession: {
        id: "session-2",
        name: "Heat 2",
        racers: stagedRacers,
      },
      currentSessionId: "session-2",
      currentSession: {
        id: "session-2",
        name: "Heat 2",
        racers: stagedRacers,
      },
      nextSessionId: null,
      nextSession: null,
      queuedSessionIds: [],
      queuedSessions: [],
      lockedSession: {
        id: "session-1",
        name: "Heat 1",
        racers: finishedRacers,
      },
      finalResults: finishedRacers.map((racer, index) => ({
        position: index + 1,
        racerId: racer.id,
        name: racer.name,
        carNumber: racer.carNumber,
        lapCount: racer.lapCount,
        currentLapTimeMs: racer.currentLapTimeMs,
        bestLapTimeMs: racer.bestLapTimeMs,
        finishPlace: index + 1,
      })),
      leaderboard: finishedRacers.map((racer, index) => ({
        position: index + 1,
        racerId: racer.id,
        name: racer.name,
        carNumber: racer.carNumber,
        lapCount: racer.lapCount,
        currentLapTimeMs: racer.currentLapTimeMs,
        bestLapTimeMs: racer.bestLapTimeMs,
        finishPlace: index + 1,
      })),
      sessions: [
        {
          id: "session-2",
          name: "Heat 2",
          racers: stagedRacers,
        },
      ],
    },
  });

  const rosterCount = (html.match(/class="roster-pill"/g) || []).length;

  assert.equal(html.includes("Proceed to paddock"), true);
  assert.equal(html.includes("Up next"), true);
  assert.equal(html.includes("Heat 1"), true);
  assert.equal(html.includes("Heat 2"), true);
  assert.equal(
    html.includes(
      "Next staged session roster and assigned cars are ready for the Safety Official briefing. Cars start from paddock."
    ),
    true
  );
  assert.equal(rosterCount, 16);
  assert.equal(html.includes("Finished 8"), true);
  assert.equal(html.includes("Staged 8"), true);
  assert.equal(html.includes("Car 18"), true);
  assert.equal(html.indexOf("Proceed to paddock") < html.indexOf("Up next"), true);
});
