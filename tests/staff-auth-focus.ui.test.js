const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("./helpers/testHarness");

function buildSnapshot() {
  return {
    serverTime: "2026-03-26T09:00:00.000Z",
    state: "STAGING",
    mode: "SAFE",
    flag: "SAFE",
    lapEntryAllowed: false,
    finishOrderActive: false,
    raceDurationSeconds: 60,
    remainingSeconds: 60,
    endsAt: null,
    activeSessionId: "session-1",
    activeSession: {
      id: "session-1",
      name: "Morning Heat",
      racers: [],
    },
    lockedSession: null,
    sessions: [
      {
        id: "session-1",
        name: "Morning Heat",
        racers: [],
      },
    ],
    leaderboard: [],
  };
}

function createFakeElement(id, documentRef) {
  return {
    id,
    disabled: false,
    value: "",
    selectionStart: 0,
    selectionEnd: 0,
    selectionDirection: "none",
    listeners: {},
    addEventListener(type, handler) {
      this.listeners[type] ||= [];
      this.listeners[type].push(handler);
    },
    focus() {
      documentRef.activeElement = this;
    },
    setSelectionRange(start, end, direction = "none") {
      this.selectionStart = start;
      this.selectionEnd = end;
      this.selectionDirection = direction;
    },
    click() {
      this.dispatch("click");
    },
    dispatch(type, extra = {}) {
      const handlers = this.listeners[type] || [];
      const event = {
        target: this,
        currentTarget: this,
        key: extra.key,
        preventDefault() {},
      };
      handlers.forEach((handler) => handler(event));
    },
  };
}

function createHarness(pathname) {
  const source = fs.readFileSync(path.join(__dirname, "..", "client", "app.js"), "utf8");
  const elements = new Map();
  const appEl = {};

  const document = {
    activeElement: null,
    fullscreenEnabled: false,
    fullscreenElement: null,
    documentElement: {
      requestFullscreen: async () => {},
    },
    getElementById(id) {
      if (id === "app") {
        return appEl;
      }
      return elements.get(id) || null;
    },
    querySelectorAll() {
      return [];
    },
    addEventListener() {},
  };

  Object.defineProperty(appEl, "innerHTML", {
    get() {
      return this._html || "";
    },
    set(value) {
      this._html = value;
      elements.clear();

      const inputMatch = value.match(/<input id="staff-key"[^>]*value="([^"]*)"([^>]*)>/);
      if (inputMatch) {
        const input = createFakeElement("staff-key", document);
        input.value = inputMatch[1];
        input.disabled = /\sdisabled(?=[\s>])/.test(inputMatch[2]);
        input.selectionStart = input.value.length;
        input.selectionEnd = input.value.length;
        elements.set("staff-key", input);
      }

      if (value.includes('id="verify-btn"')) {
        elements.set("verify-btn", createFakeElement("verify-btn", document));
      }
    },
  });

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
        serverTime: "2026-03-26T09:00:00.000Z",
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
    requestAnimationFrame: (callback) => setTimeout(callback, 0),
    cancelAnimationFrame: (id) => clearTimeout(id),
  });

  return { document };
}

async function bootstrapRoute(pathname) {
  const harness = createHarness(pathname);
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  return harness;
}

for (const pathname of ["/front-desk", "/race-control", "/lap-line-tracker"]) {
  test(`staff auth input keeps focus while typing on ${pathname}`, async () => {
    const { document } = await bootstrapRoute(pathname);
    let keyInput = document.getElementById("staff-key");

    assert.ok(keyInput, "expected staff auth input to be rendered");

    keyInput.focus();
    keyInput.setSelectionRange(0, 0);

    for (const char of ["e", "r", "k"]) {
      keyInput.value += char;
      keyInput.setSelectionRange(keyInput.value.length, keyInput.value.length);
      keyInput.dispatch("input");

      keyInput = document.getElementById("staff-key");
      assert.ok(keyInput, "expected staff auth input to survive rerender");
      assert.equal(document.activeElement, keyInput);
      assert.equal(keyInput.value, "erk".slice(0, keyInput.value.length));
      assert.equal(keyInput.selectionStart, keyInput.value.length);
      assert.equal(keyInput.selectionEnd, keyInput.value.length);
    }
  });
}
