(() => {
  const ROUTES = {
    "/": {
      title: "Beachside Racetrack",
      subtitle: "Single-host telemetry hub",
      staff: false,
      public: false,
      accent: "safe",
      body: "Select a route from the browser path to inspect public and staff control surfaces.",
    },
    "/front-desk": {
      title: "Front Desk",
      subtitle: "Session setup and racer intake",
      staff: true,
      public: false,
      accent: "safe",
      body: "Prepare sessions, stage racers, and keep roster state in sync with realtime events.",
    },
    "/race-control": {
      title: "Race Control",
      subtitle: "Lifecycle and race mode command center",
      staff: true,
      public: false,
      accent: "warning",
      body: "Run the race lifecycle with guarded controls for start, mode, finish, and lock.",
    },
    "/lap-line-tracker": {
      title: "Lap Line Tracker",
      subtitle: "Large touch lap-entry surface",
      staff: true,
      public: false,
      accent: "danger",
      body: "Record lap crossings from oversized car buttons and monitor live leaderboard flow.",
    },
    "/leader-board": {
      title: "Leader Board",
      subtitle: "Public display skeleton",
      staff: false,
      public: true,
      accent: "safe",
      body: "Realtime leaderboard rows, best laps, and flag state will render here.",
    },
    "/next-race": {
      title: "Next Race",
      subtitle: "Public display skeleton",
      staff: false,
      public: true,
      accent: "warning",
      body: "Upcoming roster, car assignments, and pit call banners will render here.",
    },
    "/race-countdown": {
      title: "Race Countdown",
      subtitle: "Public display skeleton",
      staff: false,
      public: true,
      accent: "danger",
      body: "Countdown clock and session status banner will render here.",
    },
    "/race-flags": {
      title: "Race Flags",
      subtitle: "Public display skeleton",
      staff: false,
      public: true,
      accent: "warning",
      body: "Fullscreen-safe flag state visuals will render here.",
    },
  };

  const STAFF_STATES = Object.freeze([
    "IDLE",
    "STAGING",
    "RUNNING",
    "FINISHED",
    "LOCKED",
  ]);

  const STAFF_MODES = Object.freeze([
    { value: "SAFE", label: "Safe" },
    { value: "HAZARD_SLOW", label: "Hazard Slow" },
    { value: "HAZARD_STOP", label: "Hazard Stop" },
    { value: "FINISHED", label: "Finished" },
  ]);

  const appEl = document.getElementById("app");
  const route = ROUTES[window.location.pathname] ? window.location.pathname : "/";
  const routeConfig = ROUTES[route];
  const raceCars = Array.from({ length: 12 }, (_v, index) => index + 1);

  let socket = null;
  let publicConnectStarted = false;
  let opNoticeTimer = null;
  let actionPendingTimer = null;

  function createRaceSnapshot() {
    return {
      raceState: "IDLE",
      raceMode: "SAFE",
      session: null,
      racers: [],
      leaderboard: [],
      clockRemainingSeconds: null,
      updatedAt: null,
    };
  }

  let state = {
    bootstrap: null,
    connection: "idle",
    error: "",
    serverHello: null,
    gateStatus: routeConfig.staff ? "idle" : "success",
    gateKey: "",
    gateError: "",
    raceSnapshot: createRaceSnapshot(),
    pendingAction: "",
    opNotice: null,
    frontDeskForm: {
      sessionName: "",
      racerName: "",
      carNumber: "",
    },
  };

  function setState(patch) {
    state = { ...state, ...patch };
    render();
  }

  function setOpNotice(tone, text, holdMs = 3000) {
    if (opNoticeTimer) {
      clearTimeout(opNoticeTimer);
      opNoticeTimer = null;
    }

    setState({ opNotice: { tone, text } });
    if (holdMs > 0) {
      opNoticeTimer = setTimeout(() => {
        state = { ...state, opNotice: null };
        render();
      }, holdMs);
    }
  }

  function setPendingAction(actionName) {
    if (actionPendingTimer) {
      clearTimeout(actionPendingTimer);
      actionPendingTimer = null;
    }

    setState({ pendingAction: actionName });
    actionPendingTimer = setTimeout(() => {
      state = { ...state, pendingAction: "" };
      render();
    }, 550);
  }

  function isObject(value) {
    return typeof value === "object" && value !== null;
  }

  function normalizeRaceState(raw) {
    if (typeof raw !== "string") return null;
    const normalized = raw.toUpperCase();
    return STAFF_STATES.includes(normalized) ? normalized : null;
  }

  function normalizeRaceMode(raw) {
    if (typeof raw !== "string") return null;
    const normalized = raw.toUpperCase();
    const exists = STAFF_MODES.some((mode) => mode.value === normalized);
    return exists ? normalized : null;
  }

  function normalizeRacers(input) {
    if (!Array.isArray(input)) return [];
    return input
      .map((entry, index) => {
        if (!isObject(entry)) return null;
        const carNumber = Number.parseInt(
          entry.carNumber ?? entry.car ?? entry.number ?? "",
          10
        );
        const rawName = entry.name ?? entry.racerName ?? entry.driver ?? `Racer ${index + 1}`;
        return {
          id: String(entry.id ?? `racer-${index + 1}`),
          name: String(rawName),
          carNumber: Number.isFinite(carNumber) ? carNumber : index + 1,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.carNumber - b.carNumber);
  }

  function normalizeLeaderboard(input) {
    if (!Array.isArray(input)) return [];
    return input
      .map((entry, index) => {
        if (!isObject(entry)) return null;
        const laps = Number.parseInt(entry.laps ?? entry.lapCount ?? "0", 10);
        const bestLapMs = Number.parseInt(entry.bestLapMs ?? entry.bestLap ?? "0", 10);
        const carNumber = Number.parseInt(entry.carNumber ?? entry.car ?? "", 10);
        const name = entry.name ?? entry.racerName ?? `Car ${Number.isFinite(carNumber) ? carNumber : index + 1}`;
        return {
          position: Number.parseInt(entry.position ?? `${index + 1}`, 10) || index + 1,
          name: String(name),
          carNumber: Number.isFinite(carNumber) ? carNumber : index + 1,
          laps: Number.isFinite(laps) ? laps : 0,
          bestLapMs: Number.isFinite(bestLapMs) ? bestLapMs : null,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.position - b.position);
  }

  function mergeSnapshot(payload) {
    if (!isObject(payload)) return;

    const current = state.raceSnapshot;
    const incomingState = normalizeRaceState(payload.raceState ?? payload.state);
    const incomingMode = normalizeRaceMode(payload.raceMode ?? payload.mode);
    const incomingClock = Number.parseInt(
      payload.clockRemainingSeconds ?? payload.remainingSeconds ?? payload.secondsLeft ?? "",
      10
    );

    const merged = {
      ...current,
      raceState: incomingState || current.raceState,
      raceMode: incomingMode || current.raceMode,
      session:
        payload.session === null
          ? null
          : isObject(payload.session)
            ? {
                id: String(payload.session.id ?? current.session?.id ?? "session-1"),
                name: String(payload.session.name ?? current.session?.name ?? "Untitled Session"),
              }
            : current.session,
      racers: Array.isArray(payload.racers)
        ? normalizeRacers(payload.racers)
        : current.racers,
      leaderboard: Array.isArray(payload.leaderboard)
        ? normalizeLeaderboard(payload.leaderboard)
        : current.leaderboard,
      clockRemainingSeconds: Number.isFinite(incomingClock)
        ? Math.max(incomingClock, 0)
        : current.clockRemainingSeconds,
      updatedAt: new Date().toISOString(),
    };

    setState({ raceSnapshot: merged });
  }

  function applyRaceTick(payload) {
    if (!isObject(payload)) return;
    const nextClock = Number.parseInt(
      payload.clockRemainingSeconds ?? payload.remainingSeconds ?? payload.secondsLeft ?? "",
      10
    );
    const nextState = normalizeRaceState(payload.raceState ?? payload.state);

    if (!Number.isFinite(nextClock) && !nextState) {
      return;
    }

    setState({
      raceSnapshot: {
        ...state.raceSnapshot,
        clockRemainingSeconds: Number.isFinite(nextClock)
          ? Math.max(nextClock, 0)
          : state.raceSnapshot.clockRemainingSeconds,
        raceState: nextState || state.raceSnapshot.raceState,
        updatedAt: new Date().toISOString(),
      },
    });
  }

  async function loadBootstrap() {
    try {
      const res = await fetch("/api/bootstrap");
      const data = await res.json();
      setState({ bootstrap: data });
    } catch {
      setState({ error: "Bootstrap request failed." });
    }
  }

  function connectionLabel() {
    if (state.connection === "connected") return "Socket connected";
    if (state.connection === "connecting") return "Socket connecting";
    if (state.connection === "error") return `Socket error: ${state.error || "unknown"}`;
    if (routeConfig.staff && state.gateStatus !== "success") {
      if (state.gateStatus === "verifying") return "Awaiting key verification";
      return "Socket locked behind key gate";
    }
    return "Socket idle";
  }

  function TelemetryHeader() {
    return `
      <header class="telemetry-header">
        <div class="telemetry-copy">
          <p class="eyebrow">Beachside Racetrack</p>
          <h1>${routeConfig.title}</h1>
          <p class="subtitle">${routeConfig.subtitle}</p>
        </div>
        <div class="telemetry-meta">
          <div class="status-pill ${state.connection}">${connectionLabel()}</div>
          ${routeConfig.public ? FullscreenButton() : ""}
        </div>
      </header>
    `;
  }

  function Panel(title, body, tone = routeConfig.accent, extraClass = "") {
    return `
      <section class="panel panel-${tone} ${extraClass}">
        <div class="panel-heading">
          <h2>${title}</h2>
        </div>
        ${body}
      </section>
    `;
  }

  function FullscreenButton() {
    return '<button class="action-btn fullscreen-btn" id="fullscreen-btn" type="button">Fullscreen</button>';
  }

  function KeyGateModal() {
    if (!routeConfig.staff || state.gateStatus === "success") {
      return "";
    }

    const verifyLabel =
      state.gateStatus === "verifying" ? "Verifying..." : "Verify and connect";
    const gateBadge =
      state.gateStatus === "error"
        ? '<span class="gate-status error">Verification failed</span>'
        : state.gateStatus === "verifying"
          ? '<span class="gate-status verifying">Verifying…</span>'
          : '<span class="gate-status idle">Awaiting key</span>';

    return `
      <div class="key-gate-backdrop" role="dialog" aria-modal="true" aria-labelledby="key-gate-title">
        <div class="key-gate-shell">
          <div class="key-gate-copy">
            <p class="gate-kicker">Staff authentication required</p>
            <h3 id="key-gate-title">Unlock ${routeConfig.title}</h3>
            <p class="panel-copy">This route must verify the route key before any Socket.IO connection is allowed.</p>
          </div>
          ${gateBadge}
          <label class="field">
            <span>Access key</span>
            <input id="staff-key" type="password" autocomplete="off" value="${escapeHtml(state.gateKey)}" ${state.gateStatus === "verifying" ? "disabled" : ""} />
          </label>
          <div class="controls">
            <button class="action-btn" id="verify-btn" type="button" ${state.gateStatus === "verifying" ? "disabled" : ""}>${verifyLabel}</button>
          </div>
          <p class="error-text" id="gate-error">${escapeHtml(state.gateError)}</p>
        </div>
      </div>
    `;
  }

  function AppShell(content) {
    return `
      <div class="app-shell route-${route.replace(/\//g, "") || "home"}">
        <div class="backdrop-grid"></div>
        ${TelemetryHeader()}
        <main class="route-grid">
          ${content}
        </main>
        ${KeyGateModal()}
      </div>
    `;
  }

  function formatRaceTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "--:--";
    const mins = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const secs = Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0");
    return `${mins}:${secs}`;
  }

  function formatLapMs(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return "--";
    const total = Math.floor(ms);
    const seconds = Math.floor(total / 1000);
    const millis = (total % 1000).toString().padStart(3, "0");
    return `${seconds}.${millis}s`;
  }

  function KpiPill(label, value, tone = "safe") {
    return `
      <div class="kpi-pill tone-${tone}">
        <span>${label}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
    `;
  }

  function summaryPanel() {
    const body = `
      <p class="panel-copy">${routeConfig.body}</p>
      <div class="chip-row">
        <span class="chip">Route: ${route}</span>
        <span class="chip">${routeConfig.public ? "Public display" : routeConfig.staff ? "Staff route" : "Landing"}</span>
        <span class="chip">Milestone: M1 staff UI</span>
      </div>
    `;
    return Panel("Route Summary", body);
  }

  function bootstrapPanel() {
    const bootstrap = state.bootstrap
      ? JSON.stringify(state.bootstrap, null, 2)
      : '{"status":"loading"}';
    const serverHello = state.serverHello
      ? JSON.stringify(state.serverHello, null, 2)
      : '{"status":"waiting"}';

    return Panel(
      "Runtime Snapshot",
      `
        <div class="snapshot-stack">
          <div>
            <p class="snapshot-label">Bootstrap</p>
            <pre>${bootstrap}</pre>
          </div>
          <div>
            <p class="snapshot-label">Last server:hello</p>
            <pre>${serverHello}</pre>
          </div>
        </div>
      `,
      "warning"
    );
  }

  function staffStatePanel() {
    const snapshot = state.raceSnapshot;
    const sessionName = snapshot.session?.name || "No session";
    const notice = state.opNotice
      ? `<p class="inline-alert ${state.opNotice.tone}">${escapeHtml(state.opNotice.text)}</p>`
      : '<p class="inline-alert neutral">No operator alerts.</p>';

    return Panel(
      "Staff Runtime",
      `
        <div class="kpi-grid">
          ${KpiPill("Race State", snapshot.raceState, "safe")}
          ${KpiPill("Race Mode", snapshot.raceMode, "warning")}
          ${KpiPill("Clock", formatRaceTime(snapshot.clockRemainingSeconds), "danger")}
          ${KpiPill("Racers", String(snapshot.racers.length), "safe")}
          ${KpiPill("Session", sessionName, "warning")}
          ${KpiPill("Socket", state.connection.toUpperCase(), state.connection === "connected" ? "safe" : "danger")}
        </div>
        ${notice}
        <div class="chip-row">
          <span class="chip">Gate: ${state.gateStatus}</span>
          <span class="chip">Pending: ${state.pendingAction || "none"}</span>
          <span class="chip">Last update: ${snapshot.updatedAt ? new Date(snapshot.updatedAt).toLocaleTimeString() : "n/a"}</span>
        </div>
      `,
      "safe",
      "panel-wide"
    );
  }

  function leaderboardRows(rows) {
    if (rows.length === 0) {
      return '<p class="hint">Leaderboard is waiting for realtime updates.</p>';
    }

    const body = rows
      .map(
        (entry) => `
          <tr>
            <td>${entry.position}</td>
            <td>${escapeHtml(entry.name)}</td>
            <td>${entry.carNumber}</td>
            <td>${entry.laps}</td>
            <td>${formatLapMs(entry.bestLapMs)}</td>
          </tr>
        `
      )
      .join("");

    return `
      <div class="table-wrap">
        <table class="telemetry-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Driver</th>
              <th>Car</th>
              <th>Laps</th>
              <th>Best</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    `;
  }

  function operationAccess() {
    if (!routeConfig.staff) {
      return { ok: false, reason: "Only staff routes can send operations." };
    }
    if (state.gateStatus !== "success") {
      return { ok: false, reason: "Route is still locked behind access key verification." };
    }
    if (state.connection !== "connected" || !socket) {
      return { ok: false, reason: "Socket is not connected." };
    }
    return { ok: true, reason: "" };
  }

  function guardStartRace() {
    const raceState = state.raceSnapshot.raceState;
    if (raceState === "RUNNING") {
      return { ok: false, reason: "Race is already running." };
    }
    if (raceState === "LOCKED") {
      return { ok: false, reason: "Session is locked. Move back to staging first." };
    }
    return { ok: true, reason: "" };
  }

  function guardFinishRace() {
    if (state.raceSnapshot.raceState !== "RUNNING") {
      return { ok: false, reason: "Finish is only valid while race is RUNNING." };
    }
    return { ok: true, reason: "" };
  }

  function guardEndLock() {
    if (state.raceSnapshot.raceState !== "FINISHED") {
      return { ok: false, reason: "End lock is only valid after FINISHED." };
    }
    return { ok: true, reason: "" };
  }

  function guardLapCrossing() {
    if (!["RUNNING", "FINISHED"].includes(state.raceSnapshot.raceState)) {
      return { ok: false, reason: "Lap entry is allowed only in RUNNING or FINISHED." };
    }
    return { ok: true, reason: "" };
  }

  function withRaceSnapshot(patch) {
    setState({
      raceSnapshot: {
        ...state.raceSnapshot,
        ...patch,
        updatedAt: new Date().toISOString(),
      },
    });
  }

  function sendStaffOperation(event, payload, guardCheck, optimisticUpdate) {
    const access = operationAccess();
    if (!access.ok) {
      setOpNotice("danger", access.reason);
      return;
    }

    const guard = typeof guardCheck === "function" ? guardCheck() : { ok: true, reason: "" };
    if (!guard.ok) {
      setOpNotice("danger", guard.reason);
      return;
    }

    socket.emit(event, payload);
    setPendingAction(event);
    if (typeof optimisticUpdate === "function") {
      optimisticUpdate();
    }

    setOpNotice("success", `Sent ${event} operation.`, 2000);
  }

  function FrontDeskScreen() {
    const form = state.frontDeskForm;
    const racers = state.raceSnapshot.racers;
    const access = operationAccess();
    const sessionName = form.sessionName.trim();
    const racerName = form.racerName.trim();
    const carNumber = Number.parseInt(form.carNumber.trim(), 10);
    const hasDuplicateCar = Number.isFinite(carNumber)
      ? racers.some((racer) => racer.carNumber === carNumber)
      : false;

    const createDisabled = !access.ok || !sessionName;
    const stageDisabled = !access.ok || !state.raceSnapshot.session;
    const resetDisabled = !access.ok;
    const addRacerDisabled =
      !access.ok || !racerName || !Number.isFinite(carNumber) || hasDuplicateCar;
    const removeRacerDisabled = !access.ok || racers.length === 0;

    const racerRows = racers.length
      ? racers
          .map(
            (racer) => `
              <tr>
                <td>${racer.carNumber}</td>
                <td>${escapeHtml(racer.name)}</td>
              </tr>
            `
          )
          .join("")
      : '<tr><td colspan="2" class="hint">No racers in roster.</td></tr>';

    return Panel(
      "Front Desk Ops",
      `
        <div class="staff-form-grid">
          <label class="field">
            <span>Session name</span>
            <input id="session-name-input" type="text" value="${escapeHtml(form.sessionName)}" placeholder="Evening Heat" />
          </label>
          <div class="controls">
            <button class="action-btn" id="session-create-btn" type="button" ${createDisabled ? "disabled" : ""}>Create Session</button>
            <button class="action-btn action-warning" id="session-stage-btn" type="button" ${stageDisabled ? "disabled" : ""}>Move To Staging</button>
            <button class="action-btn action-danger" id="session-reset-btn" type="button" ${resetDisabled ? "disabled" : ""}>Reset Session</button>
          </div>
        </div>
        <div class="staff-form-grid">
          <label class="field">
            <span>Racer name</span>
            <input id="racer-name-input" type="text" value="${escapeHtml(form.racerName)}" placeholder="Driver Name" />
          </label>
          <label class="field">
            <span>Car number</span>
            <input id="car-number-input" type="number" min="1" max="99" value="${escapeHtml(form.carNumber)}" placeholder="12" />
          </label>
          <div class="controls">
            <button class="action-btn" id="racer-add-btn" type="button" ${addRacerDisabled ? "disabled" : ""}>Add Racer</button>
            <button class="action-btn action-danger" id="racer-remove-last-btn" type="button" ${removeRacerDisabled ? "disabled" : ""}>Remove Last</button>
          </div>
        </div>
        <p class="hint">${access.ok ? (hasDuplicateCar ? "Selected car number is already assigned." : "Inputs are live and guarded by socket connection state.") : escapeHtml(access.reason)}</p>
        <div class="table-wrap">
          <table class="telemetry-table compact">
            <thead>
              <tr><th>Car</th><th>Racer</th></tr>
            </thead>
            <tbody>${racerRows}</tbody>
          </table>
        </div>
      `,
      "safe"
    );
  }

  function RaceControlScreen() {
    const access = operationAccess();
    const startGuard = guardStartRace();
    const finishGuard = guardFinishRace();
    const endLockGuard = guardEndLock();

    const startDisabled = !access.ok || !startGuard.ok;
    const finishDisabled = !access.ok || !finishGuard.ok;
    const lockDisabled = !access.ok || !endLockGuard.ok;
    const guardReason = !access.ok
      ? access.reason
      : !startGuard.ok
        ? startGuard.reason
        : !finishGuard.ok
          ? finishGuard.reason
          : !endLockGuard.ok
            ? endLockGuard.reason
            : "Controls are active.";

    const modeButtonRows = STAFF_MODES.map((mode) => {
      const isActive = state.raceSnapshot.raceMode === mode.value;
      const modeBlocked = !access.ok || state.raceSnapshot.raceState === "LOCKED";
      return `
        <button class="action-btn action-ghost ${isActive ? "is-active" : ""}" id="mode-btn-${mode.value}" type="button" ${modeBlocked ? "disabled" : ""}>
          ${mode.label}
        </button>
      `;
    }).join("");

    return Panel(
      "Race Control Ops",
      `
        <div class="controls controls-tight">
          <button class="action-btn" id="race-start-btn" type="button" ${startDisabled ? "disabled" : ""}>Start Race</button>
          <button class="action-btn action-warning" id="race-finish-btn" type="button" ${finishDisabled ? "disabled" : ""}>Finish Race</button>
          <button class="action-btn action-danger" id="race-end-lock-btn" type="button" ${lockDisabled ? "disabled" : ""}>End + Lock</button>
        </div>
        <p class="hint">${escapeHtml(guardReason)}</p>
        <div class="mode-grid">${modeButtonRows}</div>
        ${leaderboardRows(state.raceSnapshot.leaderboard)}
      `,
      "warning"
    );
  }

  function LapTrackerScreen() {
    const locked = state.raceSnapshot.raceState === "LOCKED";
    const access = operationAccess();
    const blocked = locked || !access.ok;
    const buttons = raceCars
      .map(
        (carNumber) => `
          <button
            class="car-touch-btn"
            id="lap-car-${carNumber}"
            type="button"
            ${blocked ? "disabled" : ""}
          >
            <span>Car</span>
            <strong>${carNumber}</strong>
          </button>
        `
      )
      .join("");

    return Panel(
      "Lap Line Tracker",
      `
        <p class="hint">One tap sends <code>lap:crossing</code> with car number and timestamp.</p>
        <div class="car-grid">
          ${buttons}
        </div>
        ${locked ? '<div class="session-overlay">Session is LOCKED. Lap input is blocked.</div>' : ""}
        ${!locked && !access.ok ? `<p class="hint">${escapeHtml(access.reason)}</p>` : ""}
      `,
      "danger"
    );
  }

  function publicConnectPanel() {
    return Panel(
      "Public Connection Baseline",
      `
        <p class="panel-copy">This public route starts a Socket.IO handshake immediately to prove realtime transport availability.</p>
        <div class="controls">
          ${FullscreenButton()}
        </div>
      `,
      routeConfig.accent
    );
  }

  function publicSkeletonPanel() {
    const lines = {
      "/leader-board": ["Position", "Driver", "Best Lap", "Current Lap"],
      "/next-race": ["Roster", "Car Assignment", "Queue Status", "Pit Call"],
      "/race-countdown": ["Countdown", "Session Status", "Next Race", "Visual Banner"],
      "/race-flags": ["SAFE", "HAZARD", "STOP", "FINISHED"],
    }[route] || ["Placeholder"];

    const cards = lines
      .map(
        (line, index) => `
          <div class="skeleton-tile">
            <span class="tile-index">0${index + 1}</span>
            <span>${line}</span>
          </div>
        `
      )
      .join("");

    return Panel("Display Skeleton", `<div class="skeleton-grid">${cards}</div>`, routeConfig.accent);
  }

  function syncFrontDeskField(fieldName, value) {
    setState({
      frontDeskForm: {
        ...state.frontDeskForm,
        [fieldName]: value,
      },
    });
  }

  function bindSharedEvents() {
    document.querySelectorAll("#fullscreen-btn").forEach((node) => {
      node.addEventListener("click", async () => {
        if (!document.documentElement.requestFullscreen) return;
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else {
          await document.documentElement.requestFullscreen();
        }
      });
    });
  }

  function bindFrontDeskEvents() {
    const sessionInput = document.getElementById("session-name-input");
    const racerInput = document.getElementById("racer-name-input");
    const carInput = document.getElementById("car-number-input");
    const createSessionBtn = document.getElementById("session-create-btn");
    const stageBtn = document.getElementById("session-stage-btn");
    const resetBtn = document.getElementById("session-reset-btn");
    const addRacerBtn = document.getElementById("racer-add-btn");
    const removeRacerBtn = document.getElementById("racer-remove-last-btn");

    if (sessionInput) {
      sessionInput.addEventListener("input", (event) => {
        syncFrontDeskField("sessionName", event.target.value);
      });
    }

    if (racerInput) {
      racerInput.addEventListener("input", (event) => {
        syncFrontDeskField("racerName", event.target.value);
      });
    }

    if (carInput) {
      carInput.addEventListener("input", (event) => {
        syncFrontDeskField("carNumber", event.target.value);
      });
    }

    if (createSessionBtn) {
      createSessionBtn.addEventListener("click", () => {
        const sessionName = state.frontDeskForm.sessionName.trim();
        if (!sessionName) {
          setOpNotice("danger", "Session name is required.");
          return;
        }

        sendStaffOperation(
          "session:create",
          { name: sessionName },
          () => ({ ok: true, reason: "" }),
          () => {
            withRaceSnapshot({
              session: { id: `session-${Date.now()}`, name: sessionName },
              raceState: "IDLE",
            });
          }
        );
      });
    }

    if (stageBtn) {
      stageBtn.addEventListener("click", () => {
        sendStaffOperation(
          "session:update",
          { raceState: "STAGING" },
          () => {
            if (!state.raceSnapshot.session) {
              return { ok: false, reason: "Create a session before moving to staging." };
            }
            return { ok: true, reason: "" };
          },
          () => {
            withRaceSnapshot({ raceState: "STAGING" });
          }
        );
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        sendStaffOperation(
          "session:delete",
          { sessionId: state.raceSnapshot.session?.id || null },
          () => ({ ok: true, reason: "" }),
          () => {
            withRaceSnapshot({
              session: null,
              racers: [],
              leaderboard: [],
              raceState: "IDLE",
              raceMode: "SAFE",
              clockRemainingSeconds: state.bootstrap?.raceDurationSeconds ?? null,
            });
          }
        );
      });
    }

    if (addRacerBtn) {
      addRacerBtn.addEventListener("click", () => {
        const racerName = state.frontDeskForm.racerName.trim();
        const carNumber = Number.parseInt(state.frontDeskForm.carNumber.trim(), 10);

        if (!racerName || !Number.isFinite(carNumber)) {
          setOpNotice("danger", "Racer name and numeric car number are required.");
          return;
        }

        sendStaffOperation(
          "racer:add",
          { name: racerName, carNumber },
          () => ({ ok: true, reason: "" }),
          () => {
            const alreadyUsed = state.raceSnapshot.racers.some((racer) => racer.carNumber === carNumber);
            if (alreadyUsed) {
              setOpNotice("danger", `Car ${carNumber} is already assigned.`);
              return;
            }

            withRaceSnapshot({
              racers: [
                ...state.raceSnapshot.racers,
                { id: `racer-${Date.now()}`, name: racerName, carNumber },
              ].sort((a, b) => a.carNumber - b.carNumber),
            });

            setState({
              frontDeskForm: {
                ...state.frontDeskForm,
                racerName: "",
                carNumber: "",
              },
            });
          }
        );
      });
    }

    if (removeRacerBtn) {
      removeRacerBtn.addEventListener("click", () => {
        const racers = state.raceSnapshot.racers;
        const last = racers[racers.length - 1];
        if (!last) {
          setOpNotice("danger", "No racers to remove.");
          return;
        }

        sendStaffOperation(
          "racer:remove",
          { racerId: last.id },
          () => ({ ok: true, reason: "" }),
          () => {
            withRaceSnapshot({
              racers: racers.slice(0, -1),
            });
          }
        );
      });
    }
  }

  function bindRaceControlEvents() {
    const startBtn = document.getElementById("race-start-btn");
    const finishBtn = document.getElementById("race-finish-btn");
    const lockBtn = document.getElementById("race-end-lock-btn");

    if (startBtn) {
      startBtn.addEventListener("click", () => {
        sendStaffOperation(
          "race:start",
          {
            startedAt: Date.now(),
            route,
          },
          guardStartRace,
          () => {
            withRaceSnapshot({
              raceState: "RUNNING",
              raceMode: "SAFE",
              clockRemainingSeconds:
                state.raceSnapshot.clockRemainingSeconds ?? state.bootstrap?.raceDurationSeconds ?? 60,
            });
          }
        );
      });
    }

    if (finishBtn) {
      finishBtn.addEventListener("click", () => {
        sendStaffOperation(
          "race:finish",
          {
            finishedAt: Date.now(),
            route,
          },
          guardFinishRace,
          () => {
            withRaceSnapshot({
              raceState: "FINISHED",
              raceMode: "FINISHED",
            });
          }
        );
      });
    }

    if (lockBtn) {
      lockBtn.addEventListener("click", () => {
        sendStaffOperation(
          "race:end_lock",
          {
            lockedAt: Date.now(),
            route,
          },
          guardEndLock,
          () => {
            withRaceSnapshot({
              raceState: "LOCKED",
            });
          }
        );
      });
    }

    STAFF_MODES.forEach((mode) => {
      const node = document.getElementById(`mode-btn-${mode.value}`);
      if (!node) return;

      node.addEventListener("click", () => {
        sendStaffOperation(
          "race:mode:set",
          {
            mode: mode.value,
            route,
          },
          () => {
            if (state.raceSnapshot.raceState === "LOCKED") {
              return { ok: false, reason: "Cannot change race mode while LOCKED." };
            }
            return { ok: true, reason: "" };
          },
          () => {
            withRaceSnapshot({
              raceMode: mode.value,
            });
          }
        );
      });
    });
  }

  function bindLapTrackerEvents() {
    raceCars.forEach((carNumber) => {
      const node = document.getElementById(`lap-car-${carNumber}`);
      if (!node) return;

      node.addEventListener("click", () => {
        sendStaffOperation(
          "lap:crossing",
          {
            carNumber,
            timestamp: Date.now(),
            route,
          },
          guardLapCrossing,
          () => {
            const racer =
              state.raceSnapshot.racers.find((entry) => entry.carNumber === carNumber) ||
              ({ id: `car-${carNumber}`, name: `Car ${carNumber}`, carNumber });
            const existing =
              state.raceSnapshot.leaderboard.find((row) => row.carNumber === carNumber) ||
              ({
                position: state.raceSnapshot.leaderboard.length + 1,
                name: racer.name,
                carNumber,
                laps: 0,
                bestLapMs: null,
              });

            const nextLeaderboard = state.raceSnapshot.leaderboard
              .filter((row) => row.carNumber !== carNumber)
              .concat([
                {
                  ...existing,
                  name: racer.name,
                  laps: existing.laps + 1,
                  bestLapMs: existing.bestLapMs || Math.floor(42000 + Math.random() * 2500),
                },
              ])
              .sort((a, b) => {
                if (b.laps !== a.laps) return b.laps - a.laps;
                return (a.bestLapMs || Number.MAX_SAFE_INTEGER) - (b.bestLapMs || Number.MAX_SAFE_INTEGER);
              })
              .map((row, index) => ({ ...row, position: index + 1 }));

            withRaceSnapshot({
              leaderboard: nextLeaderboard,
            });
          }
        );
      });
    });
  }

  function bindStaffGate() {
    const verifyBtn = document.getElementById("verify-btn");
    const keyInput = document.getElementById("staff-key");
    const gateError = document.getElementById("gate-error");
    if (!verifyBtn || !keyInput || !gateError) return;

    keyInput.addEventListener("input", (event) => {
      setState({
        gateKey: event.target.value,
        gateError: "",
        gateStatus: state.gateStatus === "error" ? "idle" : state.gateStatus,
      });
    });

    keyInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        verifyBtn.click();
      }
    });

    verifyBtn.addEventListener("click", async () => {
      const key = keyInput.value.trim();
      if (!key) {
        setState({ gateError: "Access key is required.", gateStatus: "error" });
        return;
      }

      setState({ gateStatus: "verifying", gateError: "", error: "" });
      try {
        const result = await verifyStaffKey(key);
        if (!result.ok) {
          setState({
            connection: "idle",
            error: "",
            gateStatus: "error",
            gateError: "Invalid access key.",
          });
          return;
        }
        setState({
          gateStatus: "success",
          gateError: "",
          gateKey: key,
        });
        connectSocket(key);
      } catch {
        setState({
          connection: "error",
          error: "Verification failed.",
          gateStatus: "error",
          gateError: "Verification failed.",
        });
      }
    });
  }

  async function verifyStaffKey(key) {
    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ route, key }),
    });
    return { ok: res.ok };
  }

  function connectSocket(key) {
    if (socket) {
      socket.disconnect();
      socket = null;
    }

    setState({ connection: "connecting", error: "" });
    socket = window.io({
      auth: { route, key },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 600,
      reconnectionDelayMax: 1600,
    });

    socket.on("connect", () => {
      setState({ connection: "connected", error: "" });
      socket.emit("client:hello", { route, role: routeConfig.public ? "public" : "staff" });

      if (routeConfig.staff) {
        socket.emit("auth:join_staff", {
          route,
          connectedAt: Date.now(),
        });
      }
    });

    socket.on("server:hello", (payload) => {
      setState({ serverHello: payload });
      mergeSnapshot(payload);
    });

    socket.on("state:bootstrap", (payload) => {
      mergeSnapshot(payload);
    });

    socket.on("state:snapshot", (payload) => {
      mergeSnapshot(payload);
    });

    socket.on("race:snapshot", (payload) => {
      mergeSnapshot(payload);
    });

    socket.on("race:tick", (payload) => {
      applyRaceTick(payload);
    });

    socket.on("leaderboard:update", (payload) => {
      if (!isObject(payload)) return;
      const rows = Array.isArray(payload.rows)
        ? payload.rows
        : Array.isArray(payload.leaderboard)
          ? payload.leaderboard
          : [];
      if (rows.length === 0) return;

      withRaceSnapshot({
        leaderboard: normalizeLeaderboard(rows),
      });
    });

    socket.on("server:error", (payload) => {
      const message = payload?.message || "Server rejected operation.";
      setOpNotice("danger", message);
    });

    socket.on("ui:error", (payload) => {
      const message = payload?.message || "UI operation failed.";
      setOpNotice("danger", message);
    });

    socket.on("connect_error", (err) => {
      setState({ connection: "error", error: err?.message || "Socket connection failed." });
    });

    socket.on("disconnect", () => {
      setState({ connection: "idle" });
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function render() {
    const panels = [summaryPanel()];

    if (routeConfig.public) {
      panels.push(publicConnectPanel(), publicSkeletonPanel());
    }

    if (routeConfig.staff) {
      panels.push(staffStatePanel());
      if (route === "/front-desk") {
        panels.push(FrontDeskScreen());
      }
      if (route === "/race-control") {
        panels.push(RaceControlScreen());
      }
      if (route === "/lap-line-tracker") {
        panels.push(LapTrackerScreen());
      }
    }

    panels.push(bootstrapPanel());
    appEl.innerHTML = AppShell(panels.join(""));

    bindSharedEvents();
    if (routeConfig.staff) {
      bindStaffGate();
      if (route === "/front-desk") {
        bindFrontDeskEvents();
      }
      if (route === "/race-control") {
        bindRaceControlEvents();
      }
      if (route === "/lap-line-tracker") {
        bindLapTrackerEvents();
      }
    }

    if (routeConfig.public && !publicConnectStarted) {
      publicConnectStarted = true;
      connectSocket(undefined);
    }
  }

  loadBootstrap();
  render();

  window.RacetrackUI = {
    AppShell,
    Panel,
    TelemetryHeader,
    FullscreenButton,
    KeyGateModal,
  };
})();
