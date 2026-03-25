const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("./helpers/testHarness");

function buildSnapshot() {
  return {
    serverTime: "2026-03-25T12:00:00.000Z",
    state: "IDLE",
    mode: "SAFE",
    flag: "SAFE",
    lapEntryAllowed: false,
    raceDurationSeconds: 60,
    remainingSeconds: 60,
    endsAt: null,
    activeSessionId: null,
    activeSession: null,
    lockedSession: null,
    sessions: [],
    leaderboard: [],
  };
}

async function renderFrontDesk(featureFlags) {
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
        featureFlags,
        staffAuthDisabled: false,
        serverTime: "2026-03-25T12:00:00.000Z",
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

test("front-desk keeps the manual assignment panel hidden when the flag is off", async () => {
  const html = await renderFrontDesk({
    FF_PERSISTENCE: false,
    FF_MANUAL_CAR_ASSIGNMENT: false,
  });

  assert.equal(html.includes("Manual Car Assignment"), false);
  assert.equal(html.includes("FF_MANUAL_CAR_ASSIGNMENT"), false);
});

test("front-desk shows the manual assignment panel when the flag is on", async () => {
  const html = await renderFrontDesk({
    FF_PERSISTENCE: false,
    FF_MANUAL_CAR_ASSIGNMENT: true,
  });

  assert.equal(html.includes("Manual Car Assignment"), true);
  assert.equal(html.includes("FF_MANUAL_CAR_ASSIGNMENT"), true);
});
