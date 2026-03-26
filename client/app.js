(() => {
  const ROUTES = {
    "/": {
      title: "Beachside Racetrack",
      subtitle: "M1 control hub",
      staff: false,
      public: false,
      accent: "safe",
      body: "Use the dedicated staff and public routes to run the live race flow.",
    },
    "/front-desk": {
      title: "Front Desk",
      subtitle: "Session and racer operations",
      staff: true,
      public: false,
      accent: "safe",
      body: "Create, update, stage, and clean up sessions and racers against the live backend.",
    },
    "/race-control": {
      title: "Race Control",
      subtitle: "Lifecycle and mode controls",
      staff: true,
      public: false,
      accent: "warning",
      body: "Run the authoritative lifecycle from STAGING through FINISHED and LOCKED.",
    },
    "/lap-line-tracker": {
      title: "Lap Line Tracker",
      subtitle: "Authoritative lap entry",
      staff: true,
      public: false,
      accent: "danger",
      body: "Register real lap crossings for the active session and watch the leaderboard update live.",
    },
    "/leader-board": {
      title: "Leader Board",
      subtitle: "Live best-lap order",
      staff: false,
      public: true,
      accent: "safe",
      body: "Realtime leaderboard driven by the canonical race snapshot and leaderboard stream.",
    },
    "/next-race": {
      title: "Next Race",
      subtitle: "Queued and current session view",
      staff: false,
      public: true,
      accent: "warning",
      body: "Live roster view for the active session and the next queued session.",
    },
    "/race-countdown": {
      title: "Race Countdown",
      subtitle: "Server-authoritative timer",
      staff: false,
      public: true,
      accent: "danger",
      body: "Countdown screen driven by the canonical timer and lifecycle state.",
    },
    "/race-flags": {
      title: "Race Flags",
      subtitle: "Live mode and state board",
      staff: false,
      public: true,
      accent: "warning",
      body: "Fullscreen-friendly public flag board wired to the live race state.",
    },
  };

  const MODE_META = {
    SAFE: {
      label: "Safe",
      tone: "safe",
      detail: "Track is operating under normal conditions.",
    },
    HAZARD_SLOW: {
      label: "Hazard Slow",
      tone: "warning",
      detail: "Drivers must reduce pace and follow marshal guidance.",
    },
    HAZARD_STOP: {
      label: "Hazard Stop",
      tone: "danger",
      detail: "Drivers must stop. No further racing pace is allowed.",
    },
  };

  const STATE_META = {
    IDLE: {
      label: "Idle",
      tone: "safe",
      detail: "No session is staged yet.",
    },
    STAGING: {
      label: "Staging",
      tone: "warning",
      detail: "The active session is staged and ready to start.",
    },
    RUNNING: {
      label: "Running",
      tone: "safe",
      detail: "Race is live and lap input is accepted.",
    },
    FINISHED: {
      label: "Finished",
      tone: "warning",
      detail: "Finish has been called. Crossings still count until lock.",
    },
    LOCKED: {
      label: "Locked",
      tone: "danger",
      detail: "The session is locked and lap input is blocked.",
    },
  };

  const RACE_CONTROL_MODES = ["SAFE", "HAZARD_SLOW", "HAZARD_STOP"];

  const appEl = document.getElementById("app");
  const route = ROUTES[window.location.pathname] ? window.location.pathname : "/";
  const routeConfig = ROUTES[route];

  let socket = null;
  let publicConnectStarted = false;
  let noticeTimer = null;
  let state = {
    bootstrap: null,
    connection: "idle",
    error: "",
    serverHello: null,
    gateStatus: routeConfig.staff ? "idle" : "success",
    gateKey: "",
    gateError: "",
    pending: false,
    opNotice: null,
    sessionForm: {
      id: null,
      name: "",
    },
    racerForm: {
      id: null,
      name: "",
      carNumber: "",
    },
    raceSnapshot: createEmptyRaceSnapshot(),
  };

  function createEmptyRaceSnapshot() {
    return {
      serverTime: null,
      state: "IDLE",
      mode: "SAFE",
      raceDurationSeconds: 60,
      remainingSeconds: 60,
      endsAt: null,
      activeSessionId: null,
      activeSession: null,
      currentSessionId: null,
      currentSession: null,
      nextSessionId: null,
      nextSession: null,
      queuedSessionIds: [],
      queuedSessions: [],
      sessions: [],
      leaderboard: [],
    };
  }

  function setState(patch) {
    state = { ...state, ...patch };
    render();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function isObject(value) {
    return typeof value === "object" && value !== null;
  }

  function parseNumber(value) {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return "--:--";
    }

    const minutes = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const secs = Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0");
    return `${minutes}:${secs}`;
  }

  function formatLap(milliseconds) {
    if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
      return "--";
    }

    const seconds = (milliseconds / 1000).toFixed(3);
    return `${seconds}s`;
  }

  function sortLeaderboard(entries) {
    return entries
      .slice()
      .sort((left, right) => {
        if (left.bestLapTimeMs === null && right.bestLapTimeMs === null) {
          return left.name.localeCompare(right.name);
        }

        if (left.bestLapTimeMs === null) {
          return 1;
        }

        if (right.bestLapTimeMs === null) {
          return -1;
        }

        if (left.bestLapTimeMs !== right.bestLapTimeMs) {
          return left.bestLapTimeMs - right.bestLapTimeMs;
        }

        return right.lapCount - left.lapCount;
      })
      .map((entry, index) => ({
        ...entry,
        position: index + 1,
      }));
  }

  function normalizeRacer(racer) {
    return {
      id: String(racer.id),
      name: String(racer.name),
      carNumber: racer.carNumber === null ? null : String(racer.carNumber ?? ""),
      lapCount: parseNumber(racer.lapCount) ?? 0,
      currentLapTimeMs: parseNumber(racer.currentLapTimeMs),
      bestLapTimeMs: parseNumber(racer.bestLapTimeMs),
      lastCrossingTimestampMs: parseNumber(racer.lastCrossingTimestampMs),
      createdAt: racer.createdAt ?? null,
      updatedAt: racer.updatedAt ?? null,
    };
  }

  function compareRacers(left, right) {
    const leftCar = left.carNumber === null ? Number.MAX_SAFE_INTEGER : parseNumber(left.carNumber);
    const rightCar =
      right.carNumber === null ? Number.MAX_SAFE_INTEGER : parseNumber(right.carNumber);

    if (leftCar !== rightCar) {
      return leftCar - rightCar;
    }

    return left.name.localeCompare(right.name);
  }

  function normalizeSession(session) {
    return {
      id: String(session.id),
      name: String(session.name),
      racers: Array.isArray(session.racers)
        ? session.racers.map(normalizeRacer).sort(compareRacers)
        : [],
      createdAt: session.createdAt ?? null,
      updatedAt: session.updatedAt ?? null,
    };
  }

  function normalizeLeaderboardEntry(entry) {
    return {
      position: parseNumber(entry.position) ?? 0,
      racerId: String(entry.racerId),
      name: String(entry.name),
      carNumber: entry.carNumber === null ? null : String(entry.carNumber ?? ""),
      lapCount: parseNumber(entry.lapCount) ?? 0,
      currentLapTimeMs: parseNumber(entry.currentLapTimeMs),
      bestLapTimeMs: parseNumber(entry.bestLapTimeMs),
    };
  }

  function normalizeSnapshot(snapshot) {
    if (!isObject(snapshot)) {
      return state.raceSnapshot;
    }

    const sessions = Array.isArray(snapshot.sessions)
      ? snapshot.sessions.map(normalizeSession)
      : [];
    const activeSessionId = snapshot.activeSessionId ? String(snapshot.activeSessionId) : null;
    const activeSession =
      isObject(snapshot.activeSession) && snapshot.activeSession !== null
        ? normalizeSession(snapshot.activeSession)
        : sessions.find((session) => session.id === activeSessionId) || null;
    const currentSessionId = snapshot.currentSessionId ? String(snapshot.currentSessionId) : null;
    const currentSession =
      isObject(snapshot.currentSession) && snapshot.currentSession !== null
        ? normalizeSession(snapshot.currentSession)
        : currentSessionId
          ? sessions.find((session) => session.id === currentSessionId) || null
          : activeSession;
    const nextSessionId = snapshot.nextSessionId ? String(snapshot.nextSessionId) : null;
    const nextSession =
      isObject(snapshot.nextSession) && snapshot.nextSession !== null
        ? normalizeSession(snapshot.nextSession)
        : nextSessionId
          ? sessions.find((session) => session.id === nextSessionId) || null
          : sessions.find((session) => session.id !== currentSessionId) || null;
    const queuedSessions = Array.isArray(snapshot.queuedSessions)
      ? snapshot.queuedSessions.map(normalizeSession)
      : sessions.filter((session) => session.id !== currentSessionId);
    const queuedSessionIds = Array.isArray(snapshot.queuedSessionIds)
      ? snapshot.queuedSessionIds.map((sessionId) => String(sessionId))
      : queuedSessions.map((session) => session.id);

    return {
      serverTime: snapshot.serverTime ?? null,
      state: snapshot.state || "IDLE",
      mode: snapshot.mode || "SAFE",
      raceDurationSeconds:
        parseNumber(snapshot.raceDurationSeconds) ?? state.raceSnapshot.raceDurationSeconds,
      remainingSeconds:
        parseNumber(snapshot.remainingSeconds) ?? state.raceSnapshot.remainingSeconds,
      endsAt: snapshot.endsAt ?? null,
      activeSessionId,
      activeSession,
      currentSessionId,
      currentSession,
      nextSessionId,
      nextSession,
      queuedSessionIds,
      queuedSessions,
      sessions,
      leaderboard: Array.isArray(snapshot.leaderboard)
        ? sortLeaderboard(snapshot.leaderboard.map(normalizeLeaderboardEntry))
        : [],
    };
  }

  function getActiveSession() {
    return state.raceSnapshot.currentSession || state.raceSnapshot.activeSession;
  }

  function getQueuedSessions() {
    return state.raceSnapshot.queuedSessions.length > 0
      ? state.raceSnapshot.queuedSessions
      : state.raceSnapshot.sessions.filter(
          (session) => session.id !== state.raceSnapshot.currentSessionId
        );
  }

  function getFlagMeta(snapshot = state.raceSnapshot) {
    if (snapshot.state === "RUNNING") {
      return MODE_META[snapshot.mode] || MODE_META.SAFE;
    }

    if (snapshot.state === "FINISHED") {
      return {
        label: "Checkered",
        tone: "warning",
        detail: STATE_META.FINISHED.detail,
      };
    }

    if (snapshot.state === "LOCKED") {
      return {
        label: "Locked",
        tone: "danger",
        detail: STATE_META.LOCKED.detail,
      };
    }

    return {
      label: STATE_META[snapshot.state]?.label || "Idle",
      tone: STATE_META[snapshot.state]?.tone || "safe",
      detail: STATE_META[snapshot.state]?.detail || "",
    };
  }

  function applyCanonicalSnapshot(snapshot) {
    const normalized = normalizeSnapshot(snapshot);
    const nextSessionForm = normalized.sessions.some(
      (session) => session.id === state.sessionForm.id
    )
      ? state.sessionForm
      : { id: null, name: "" };
    const activeSession = normalized.activeSession;
    const nextRacerForm =
      activeSession && activeSession.racers.some((racer) => racer.id === state.racerForm.id)
        ? state.racerForm
        : { id: null, name: "", carNumber: "" };

    setState({
      raceSnapshot: normalized,
      sessionForm: nextSessionForm,
      racerForm: nextRacerForm,
    });
  }

  function applyLeaderboardUpdate(payload) {
    if (!isObject(payload) || !Array.isArray(payload.leaderboard)) {
      return;
    }

    setState({
      raceSnapshot: {
        ...state.raceSnapshot,
        state: payload.state || state.raceSnapshot.state,
        activeSessionId:
          payload.activeSessionId === null || payload.activeSessionId === undefined
            ? state.raceSnapshot.activeSessionId
            : String(payload.activeSessionId),
        leaderboard: sortLeaderboard(payload.leaderboard.map(normalizeLeaderboardEntry)),
      },
    });
  }

  function applyRaceTick(payload) {
    if (!isObject(payload)) {
      return;
    }

    const remainingSeconds = parseNumber(payload.remainingSeconds);
    setState({
      raceSnapshot: {
        ...state.raceSnapshot,
        state: payload.state || state.raceSnapshot.state,
        remainingSeconds:
          remainingSeconds === null ? state.raceSnapshot.remainingSeconds : remainingSeconds,
        endsAt: payload.endsAt ?? state.raceSnapshot.endsAt,
        serverTime: payload.serverTime ?? state.raceSnapshot.serverTime,
      },
    });
  }

  function setNotice(tone, text, holdMs = 3200) {
    if (noticeTimer) {
      clearTimeout(noticeTimer);
      noticeTimer = null;
    }

    setState({ opNotice: { tone, text } });
    if (holdMs > 0) {
      noticeTimer = setTimeout(() => {
        state = { ...state, opNotice: null };
        render();
      }, holdMs);
    }
  }

  async function loadBootstrap() {
    try {
      const res = await fetch("/api/bootstrap");
      const data = await res.json();
      const nextState = { bootstrap: data };
      if (data.raceSnapshot) {
        nextState.raceSnapshot = normalizeSnapshot(data.raceSnapshot);
      }
      setState(nextState);
    } catch {
      setNotice("danger", "Bootstrap request failed.", 4000);
      setState({ error: "Bootstrap request failed." });
    }
  }

  function connectionLabel() {
    if (state.connection === "connected") {
      return "Socket connected";
    }

    if (state.connection === "connecting") {
      return "Socket connecting";
    }

    if (state.connection === "error") {
      return `Socket error: ${state.error || "unknown"}`;
    }

    if (routeConfig.staff && state.gateStatus !== "success") {
      if (state.gateStatus === "verifying") {
        return "Awaiting key verification";
      }
      return "Socket locked behind key gate";
    }

    return "Socket idle";
  }

  function staffReady() {
    return routeConfig.staff && state.gateStatus === "success" && state.gateKey.trim() !== "";
  }

  function fullscreenButton() {
    return '<button class="action-btn fullscreen-btn" id="fullscreen-btn" type="button">Fullscreen</button>';
  }

  function telemetryHeader() {
    return `
      <header class="telemetry-header">
        <div class="telemetry-copy">
          <p class="eyebrow">Beachside Racetrack</p>
          <h1>${routeConfig.title}</h1>
          <p class="subtitle">${routeConfig.subtitle}</p>
        </div>
        <div class="telemetry-meta">
          <div class="status-pill ${state.connection}">${escapeHtml(connectionLabel())}</div>
          ${routeConfig.public ? fullscreenButton() : ""}
        </div>
      </header>
    `;
  }

  function panel(title, body, tone = routeConfig.accent, extraClass = "") {
    return `
      <section class="panel panel-${tone} ${extraClass}">
        <div class="panel-heading">
          <h2>${title}</h2>
        </div>
        ${body}
      </section>
    `;
  }

  function keyGateModal() {
    if (!routeConfig.staff || state.gateStatus === "success") {
      return "";
    }

    const verifyLabel =
      state.gateStatus === "verifying" ? "Verifying..." : "Verify and connect";
    const gateBadge =
      state.gateStatus === "error"
        ? '<span class="gate-status error">Verification failed</span>'
        : state.gateStatus === "verifying"
          ? '<span class="gate-status verifying">Verifying...</span>'
          : '<span class="gate-status idle">Awaiting key</span>';

    return `
      <div class="key-gate-backdrop" role="dialog" aria-modal="true" aria-labelledby="key-gate-title">
        <div class="key-gate-shell">
          <div class="key-gate-copy">
            <p class="gate-kicker">Staff authentication required</p>
            <h3 id="key-gate-title">Unlock ${routeConfig.title}</h3>
            <p class="panel-copy">This route verifies the staff key before any socket connection is created.</p>
          </div>
          ${gateBadge}
          <label class="field">
            <span>Access key</span>
            <input id="staff-key" type="password" autocomplete="off" value="${escapeHtml(state.gateKey)}" ${state.gateStatus === "verifying" ? "disabled" : ""} />
          </label>
          <div class="controls">
            <button class="action-btn" id="verify-btn" type="button" ${state.gateStatus === "verifying" ? "disabled" : ""}>${verifyLabel}</button>
          </div>
          <p class="error-text">${escapeHtml(state.gateError)}</p>
        </div>
      </div>
    `;
  }

  function appShell(content) {
    return `
      <div class="app-shell route-${route.replace(/\//g, "") || "home"}">
        <div class="backdrop-grid"></div>
        ${telemetryHeader()}
        <main class="route-grid">
          ${content}
        </main>
        ${keyGateModal()}
      </div>
    `;
  }

  function noticeMarkup() {
    if (!state.opNotice) {
      return "";
    }

    return `<p class="inline-alert ${state.opNotice.tone}">${escapeHtml(state.opNotice.text)}</p>`;
  }

  function kpiPill(label, value, tone = "safe") {
    return `
      <div class="kpi-pill tone-${tone}">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
    `;
  }

  function summaryPanel() {
    return panel(
      "Route Summary",
      `
        <p class="panel-copy">${routeConfig.body}</p>
        <div class="chip-row">
          <span class="chip">Route: ${escapeHtml(route)}</span>
          <span class="chip">${routeConfig.public ? "Public display" : routeConfig.staff ? "Staff route" : "Landing"}</span>
          <span class="chip">M1 canonical flow</span>
        </div>
      `
    );
  }

  function runtimePanel() {
    const bootstrap = state.bootstrap
      ? JSON.stringify(state.bootstrap, null, 2)
      : '{"status":"loading"}';
    const serverHello = state.serverHello
      ? JSON.stringify(state.serverHello, null, 2)
      : '{"status":"waiting"}';

    return panel(
      "Runtime Snapshot",
      `
        <div class="snapshot-stack">
          <div>
            <p class="snapshot-label">Bootstrap</p>
            <pre>${escapeHtml(bootstrap)}</pre>
          </div>
          <div>
            <p class="snapshot-label">Last server:hello</p>
            <pre>${escapeHtml(serverHello)}</pre>
          </div>
        </div>
      `,
      "warning"
    );
  }

  function staffStatusPanel() {
    const snapshot = state.raceSnapshot;
    const activeSession = getActiveSession();
    const flagMeta = getFlagMeta(snapshot);
    return panel(
      "Staff Runtime",
      `
        <div class="kpi-grid">
          ${kpiPill("Race State", STATE_META[snapshot.state]?.label || snapshot.state, STATE_META[snapshot.state]?.tone || "safe")}
          ${kpiPill("Mode", MODE_META[snapshot.mode]?.label || snapshot.mode, flagMeta.tone)}
          ${kpiPill("Countdown", formatTime(snapshot.remainingSeconds), "danger")}
          ${kpiPill("Active Session", activeSession ? activeSession.name : "None", activeSession ? "warning" : "danger")}
          ${kpiPill("Racers", String(activeSession ? activeSession.racers.length : 0), "safe")}
          ${kpiPill("Socket", state.connection.toUpperCase(), state.connection === "connected" ? "safe" : "danger")}
        </div>
        ${noticeMarkup()}
        <p class="hint">${escapeHtml(flagMeta.detail)}</p>
      `,
      "safe",
      "panel-wide"
    );
  }

  function requestHeaders() {
    return {
      "Content-Type": "application/json",
      "x-staff-route": route,
      "x-staff-key": state.gateKey.trim(),
    };
  }

  async function verifyStaffKey(key) {
    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ route, key }),
    });
    return { ok: res.ok };
  }

  async function apiRequest(pathname, options = {}) {
    if (!staffReady()) {
      throw new Error("Verify the staff key before sending commands.");
    }

    const method = options.method || "GET";
    const init = {
      method,
      headers: requestHeaders(),
    };

    if (options.body !== undefined) {
      init.body = JSON.stringify(options.body);
    }

    const response = await fetch(pathname, init);
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};
    if (!response.ok) {
      throw new Error(payload.message || `Request failed (${response.status}).`);
    }
    return payload;
  }

  async function runAction(executor, successMessage, onSuccess) {
    setState({ pending: true });
    try {
      const payload = await executor();
      if (payload && payload.raceSnapshot) {
        applyCanonicalSnapshot(payload.raceSnapshot);
      }
      if (typeof onSuccess === "function") {
        onSuccess(payload);
      }
      if (successMessage) {
        setNotice("success", successMessage);
      }
    } catch (error) {
      setNotice("danger", error.message || "Operation failed.", 4200);
    } finally {
      setState({ pending: false });
    }
  }

  function sessionRows() {
    if (state.raceSnapshot.sessions.length === 0) {
      return '<tr><td colspan="4" class="hint">No sessions created yet.</td></tr>';
    }

    return state.raceSnapshot.sessions
      .map((session) => {
        const active = session.id === state.raceSnapshot.activeSessionId;
        const editBlocked =
          active &&
          (state.raceSnapshot.state === "RUNNING" || state.raceSnapshot.state === "FINISHED");
        const stageBlocked =
          state.raceSnapshot.state === "RUNNING" || state.raceSnapshot.state === "FINISHED";

        return `
          <tr>
            <td>${escapeHtml(session.name)}</td>
            <td>${active ? '<span class="chip tiny-chip">ACTIVE</span>' : '<span class="chip tiny-chip">QUEUED</span>'}</td>
            <td>${session.racers.length}</td>
            <td>
              <div class="row-actions">
                <button class="action-btn action-ghost mini-btn" data-action="stage-session" data-session-id="${escapeHtml(session.id)}" ${active || stageBlocked || state.pending ? "disabled" : ""}>Stage</button>
                <button class="action-btn action-ghost mini-btn" data-action="edit-session" data-session-id="${escapeHtml(session.id)}" ${editBlocked || state.pending ? "disabled" : ""}>Edit</button>
                <button class="action-btn action-danger mini-btn" data-action="delete-session" data-session-id="${escapeHtml(session.id)}" ${editBlocked || state.pending ? "disabled" : ""}>Delete</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function racerRows(activeSession) {
    if (!activeSession) {
      return '<tr><td colspan="4" class="hint">Stage a session to manage racers.</td></tr>';
    }

    if (activeSession.racers.length === 0) {
      return '<tr><td colspan="4" class="hint">No racers in the active session.</td></tr>';
    }

    const editBlocked =
      state.raceSnapshot.state === "RUNNING" || state.raceSnapshot.state === "FINISHED";

    return activeSession.racers
      .map(
        (racer) => `
          <tr>
            <td>${escapeHtml(racer.name)}</td>
            <td>${escapeHtml(racer.carNumber || "--")}</td>
            <td>${racer.lapCount}</td>
            <td>
              <div class="row-actions">
                <button class="action-btn action-ghost mini-btn" data-action="edit-racer" data-racer-id="${escapeHtml(racer.id)}" ${editBlocked || state.pending ? "disabled" : ""}>Edit</button>
                <button class="action-btn action-danger mini-btn" data-action="delete-racer" data-racer-id="${escapeHtml(racer.id)}" ${editBlocked || state.pending ? "disabled" : ""}>Delete</button>
              </div>
            </td>
          </tr>
        `
      )
      .join("");
  }

  function frontDeskPanel() {
    const activeSession = getActiveSession();
    const updateMode = state.sessionForm.id !== null;
    const racerUpdateMode = state.racerForm.id !== null;
    const activeEditable =
      activeSession &&
      state.raceSnapshot.state !== "RUNNING" &&
      state.raceSnapshot.state !== "FINISHED";

    return panel(
      "Front Desk Ops",
      `
        <div class="staff-form-grid">
          <label class="field">
            <span>Session name</span>
            <input id="session-name-input" type="text" value="${escapeHtml(state.sessionForm.name)}" placeholder="Evening Heat" />
          </label>
          <div class="controls">
            <button class="action-btn" id="save-session-btn" type="button" ${state.pending ? "disabled" : ""}>${updateMode ? "Save Session" : "Create Session"}</button>
            ${updateMode ? '<button class="action-btn action-ghost" id="cancel-session-edit-btn" type="button">Cancel</button>' : ""}
          </div>
        </div>
        <div class="table-wrap">
          <table class="telemetry-table compact">
            <thead>
              <tr><th>Session</th><th>Status</th><th>Racers</th><th>Actions</th></tr>
            </thead>
            <tbody>${sessionRows()}</tbody>
          </table>
        </div>
        <div class="divider"></div>
        <div class="staff-form-grid">
          <label class="field">
            <span>Racer name</span>
            <input id="racer-name-input" type="text" value="${escapeHtml(state.racerForm.name)}" placeholder="Driver Name" ${activeEditable ? "" : "disabled"} />
          </label>
          <label class="field">
            <span>Car number</span>
            <input id="car-number-input" type="text" value="${escapeHtml(state.racerForm.carNumber)}" placeholder="7" ${activeEditable ? "" : "disabled"} />
          </label>
          <div class="controls">
            <button class="action-btn" id="save-racer-btn" type="button" ${activeEditable && !state.pending ? "" : "disabled"}>${racerUpdateMode ? "Save Racer" : "Add Racer"}</button>
            ${racerUpdateMode ? '<button class="action-btn action-ghost" id="cancel-racer-edit-btn" type="button">Cancel</button>' : ""}
          </div>
        </div>
        <p class="hint">${activeSession ? "Racer edits apply to the active staged session." : "Create or stage a session before adding racers."}</p>
        <div class="table-wrap">
          <table class="telemetry-table compact">
            <thead>
              <tr><th>Racer</th><th>Car</th><th>Laps</th><th>Actions</th></tr>
            </thead>
            <tbody>${racerRows(activeSession)}</tbody>
          </table>
        </div>
      `,
      "safe"
    );
  }

  function leaderboardTable(entries) {
    if (entries.length === 0) {
      return '<p class="hint">Leaderboard is waiting for lap data.</p>';
    }

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
              <th>Current</th>
            </tr>
          </thead>
          <tbody>
            ${entries
              .map(
                (entry) => `
                  <tr>
                    <td>${entry.position}</td>
                    <td>${escapeHtml(entry.name)}</td>
                    <td>${escapeHtml(entry.carNumber || "--")}</td>
                    <td>${entry.lapCount}</td>
                    <td>${escapeHtml(formatLap(entry.bestLapTimeMs))}</td>
                    <td>${escapeHtml(formatLap(entry.currentLapTimeMs))}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function raceControlPanel() {
    const snapshot = state.raceSnapshot;
    const activeSession = getActiveSession();
    const canStart = staffReady() && snapshot.state === "STAGING" && activeSession && !state.pending;
    const canFinish = staffReady() && snapshot.state === "RUNNING" && !state.pending;
    const canLock = staffReady() && snapshot.state === "FINISHED" && !state.pending;

    const modeButtons = RACE_CONTROL_MODES.map((mode) => {
      const active = snapshot.mode === mode;
      const disabled = snapshot.state !== "RUNNING" || !staffReady() || state.pending;
      return `
        <button class="action-btn action-ghost ${active ? "is-active" : ""}" data-action="set-mode" data-mode="${mode}" type="button" ${disabled ? "disabled" : ""}>
          ${escapeHtml(MODE_META[mode].label)}
        </button>
      `;
    }).join("");

    return panel(
      "Race Control Ops",
      `
        <div class="controls controls-tight">
          <button class="action-btn" id="race-start-btn" type="button" ${canStart ? "" : "disabled"}>Start Race</button>
          <button class="action-btn action-warning" id="race-finish-btn" type="button" ${canFinish ? "" : "disabled"}>Finish Race</button>
          <button class="action-btn action-danger" id="race-lock-btn" type="button" ${canLock ? "" : "disabled"}>End + Lock</button>
        </div>
        <p class="hint">${activeSession ? `Active session: ${activeSession.name}` : "No session is staged yet. Use front desk to create or stage one."}</p>
        <div class="mode-grid">${modeButtons}</div>
        ${leaderboardTable(snapshot.leaderboard)}
      `,
      "warning"
    );
  }

  function lapTrackerPanel() {
    const snapshot = state.raceSnapshot;
    const activeSession = getActiveSession();
    const lapAllowed = snapshot.state === "RUNNING" || snapshot.state === "FINISHED";
    const racers = activeSession ? activeSession.racers : [];

    const buttons = racers.length
      ? racers
          .map(
            (racer) => `
              <button class="car-touch-btn" data-action="lap-crossing" data-racer-id="${escapeHtml(racer.id)}" type="button" ${staffReady() && lapAllowed && !state.pending ? "" : "disabled"}>
                <span>${escapeHtml(racer.carNumber || "Car")}</span>
                <strong>${escapeHtml(racer.name)}</strong>
                <em>Laps ${racer.lapCount}</em>
              </button>
            `
          )
          .join("")
      : '<div class="empty-state">No staged racers available for lap entry.</div>';

    const overlay =
      snapshot.state === "LOCKED"
        ? '<div class="session-overlay">Session is LOCKED. Lap input is blocked.</div>'
        : "";

    return panel(
      "Lap Line Tracker",
      `
        <p class="hint">Each button sends a real <code>/api/laps/crossing</code> command for the selected racer.</p>
        <div class="car-grid">${buttons}</div>
        ${overlay}
      `,
      "danger"
    );
  }

  function publicStatusPanel() {
    const snapshot = state.raceSnapshot;
    const flagMeta = getFlagMeta(snapshot);
    const activeSession = getActiveSession();

    return panel(
      "Live State",
      `
        <div class="kpi-grid">
          ${kpiPill("Phase", STATE_META[snapshot.state]?.label || snapshot.state, STATE_META[snapshot.state]?.tone || "safe")}
          ${kpiPill("Flag", flagMeta.label, flagMeta.tone)}
          ${kpiPill("Countdown", formatTime(snapshot.remainingSeconds), "danger")}
          ${kpiPill("Session", activeSession ? activeSession.name : "No active session", activeSession ? "warning" : "danger")}
        </div>
        <p class="hint">${escapeHtml(flagMeta.detail)}</p>
      `,
      flagMeta.tone,
      "panel-wide"
    );
  }

  function activeRosterTable(session) {
    if (!session || session.racers.length === 0) {
      return '<div class="empty-state">No racers staged.</div>';
    }

    return `
      <div class="table-wrap">
        <table class="telemetry-table compact">
          <thead>
            <tr><th>Racer</th><th>Car</th><th>Laps</th><th>Best</th></tr>
          </thead>
          <tbody>
            ${session.racers
              .map(
                (racer) => `
                  <tr>
                    <td>${escapeHtml(racer.name)}</td>
                    <td>${escapeHtml(racer.carNumber || "--")}</td>
                    <td>${racer.lapCount}</td>
                    <td>${escapeHtml(formatLap(racer.bestLapTimeMs))}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function leaderBoardPanels() {
    const activeSession = getActiveSession();
    const flagMeta = getFlagMeta();
    return [
      panel(
        "Current Leader",
        `
          <div class="hero-stack">
            <div class="hero-value">${escapeHtml(formatTime(state.raceSnapshot.remainingSeconds))}</div>
            <p class="hero-copy">${escapeHtml(flagMeta.detail)}</p>
            <div class="chip-row">
              <span class="chip">${escapeHtml(activeSession ? activeSession.name : "No active session")}</span>
              <span class="chip">${escapeHtml(STATE_META[state.raceSnapshot.state]?.label || state.raceSnapshot.state)}</span>
              <span class="chip">${escapeHtml(flagMeta.label)}</span>
            </div>
          </div>
        `,
        flagMeta.tone,
        "panel-wide"
      ),
      panel("Leaderboard", leaderboardTable(state.raceSnapshot.leaderboard), "safe", "panel-wide"),
    ].join("");
  }

  function nextRacePanels() {
    const activeSession = getActiveSession();
    const queued = state.raceSnapshot.nextSession || getQueuedSessions()[0] || null;

    return [
      panel(
        "Current Session",
        `
          <div class="stack-list">
            <div class="info-row"><span>Name</span><strong>${escapeHtml(activeSession ? activeSession.name : "No active session")}</strong></div>
            <div class="info-row"><span>State</span><strong>${escapeHtml(STATE_META[state.raceSnapshot.state]?.label || state.raceSnapshot.state)}</strong></div>
            <div class="info-row"><span>Racers</span><strong>${activeSession ? activeSession.racers.length : 0}</strong></div>
          </div>
          ${activeRosterTable(activeSession)}
        `,
        "warning"
      ),
      panel(
        "Next Queued Session",
        `
          <div class="stack-list">
            <div class="info-row"><span>Name</span><strong>${escapeHtml(queued ? queued.name : "No queued session")}</strong></div>
            <div class="info-row"><span>Racers</span><strong>${queued ? queued.racers.length : 0}</strong></div>
            <div class="info-row"><span>Status</span><strong>${escapeHtml(queued ? "Queued" : "Waiting")}</strong></div>
          </div>
          ${activeRosterTable(queued)}
        `,
        "safe"
      ),
    ].join("");
  }

  function countdownPanels() {
    const activeSession = getActiveSession();
    const flagMeta = getFlagMeta();
    return [
      panel(
        "Server Countdown",
        `
          <div class="countdown-board tone-${escapeHtml(flagMeta.tone)}">
            <div class="countdown-digits">${escapeHtml(formatTime(state.raceSnapshot.remainingSeconds))}</div>
            <p class="hero-copy">${escapeHtml(STATE_META[state.raceSnapshot.state]?.detail || "")}</p>
          </div>
        `,
        flagMeta.tone
      ),
      panel(
        "Session Status",
        `
          <div class="stack-list">
            <div class="info-row"><span>Session</span><strong>${escapeHtml(activeSession ? activeSession.name : "No active session")}</strong></div>
            <div class="info-row"><span>Mode</span><strong>${escapeHtml(MODE_META[state.raceSnapshot.mode]?.label || state.raceSnapshot.mode)}</strong></div>
            <div class="info-row"><span>Leaderboard Rows</span><strong>${state.raceSnapshot.leaderboard.length}</strong></div>
          </div>
        `,
        "warning"
      ),
      panel("Active Roster", activeRosterTable(activeSession), "safe", "panel-wide"),
    ].join("");
  }

  function flagPanels() {
    const flagMeta = getFlagMeta();
    return [
      panel(
        "Track Flag",
        `
          <div class="flag-board tone-${escapeHtml(flagMeta.tone)} ${state.raceSnapshot.state === "FINISHED" ? "finished-pattern" : ""}">
            <span class="flag-code">${escapeHtml(flagMeta.label.toUpperCase())}</span>
            <strong>${escapeHtml(STATE_META[state.raceSnapshot.state]?.label || state.raceSnapshot.state)}</strong>
            <p>${escapeHtml(flagMeta.detail)}</p>
            <span class="flag-timer">${escapeHtml(formatTime(state.raceSnapshot.remainingSeconds))}</span>
          </div>
        `,
        flagMeta.tone,
        "panel-wide"
      ),
    ].join("");
  }

  function homePanels() {
    return [
      summaryPanel(),
      panel(
        "Routes",
        `
          <div class="stack-list">
            ${Object.keys(ROUTES)
              .filter((pathname) => pathname !== "/")
              .map(
                (pathname) => `
                  <div class="info-row">
                    <span>${escapeHtml(pathname)}</span>
                    <strong>${escapeHtml(ROUTES[pathname].subtitle)}</strong>
                  </div>
                `
              )
              .join("")}
          </div>
        `,
        "warning"
      ),
    ].join("");
  }

  function buildContent() {
    if (route === "/front-desk") {
      return [staffStatusPanel(), frontDeskPanel(), runtimePanel()].join("");
    }

    if (route === "/race-control") {
      return [staffStatusPanel(), raceControlPanel(), runtimePanel()].join("");
    }

    if (route === "/lap-line-tracker") {
      return [staffStatusPanel(), lapTrackerPanel(), runtimePanel()].join("");
    }

    if (route === "/leader-board") {
      return [publicStatusPanel(), leaderBoardPanels()].join("");
    }

    if (route === "/next-race") {
      return [publicStatusPanel(), nextRacePanels()].join("");
    }

    if (route === "/race-countdown") {
      return [publicStatusPanel(), countdownPanels()].join("");
    }

    if (route === "/race-flags") {
      return [publicStatusPanel(), flagPanels()].join("");
    }

    return homePanels();
  }

  function bindSharedEvents() {
    document.querySelectorAll("#fullscreen-btn").forEach((node) => {
      node.addEventListener("click", async () => {
        if (!document.documentElement.requestFullscreen) {
          return;
        }

        if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen();
        } else {
          await document.documentElement.requestFullscreen();
        }
      });
    });
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
      socket.emit("client:hello", {
        route,
        role: routeConfig.public ? "public" : "staff",
      });
    });

    socket.on("server:hello", (payload) => {
      setState({ serverHello: payload });
    });

    socket.on("race:snapshot", (payload) => {
      applyCanonicalSnapshot(payload);
    });

    socket.on("leaderboard:update", (payload) => {
      applyLeaderboardUpdate(payload);
    });

    socket.on("race:tick", (payload) => {
      applyRaceTick(payload);
    });

    socket.on("server:error", (payload) => {
      setNotice("danger", payload?.message || "Server rejected the request.", 4200);
    });

    socket.on("connect_error", (err) => {
      setState({ connection: "error", error: err?.message || "Socket connection failed." });
    });

    socket.on("disconnect", () => {
      setState({ connection: "idle" });
    });
  }

  function bindStaffGate() {
    const verifyBtn = document.getElementById("verify-btn");
    const keyInput = document.getElementById("staff-key");
    if (!verifyBtn || !keyInput) {
      return;
    }

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

  function bindFrontDeskEvents() {
    const activeSession = getActiveSession();
    const sessionInput = document.getElementById("session-name-input");
    const racerInput = document.getElementById("racer-name-input");
    const carInput = document.getElementById("car-number-input");
    const saveSessionBtn = document.getElementById("save-session-btn");
    const cancelSessionEditBtn = document.getElementById("cancel-session-edit-btn");
    const saveRacerBtn = document.getElementById("save-racer-btn");
    const cancelRacerEditBtn = document.getElementById("cancel-racer-edit-btn");

    if (sessionInput) {
      sessionInput.addEventListener("input", (event) => {
        setState({
          sessionForm: {
            ...state.sessionForm,
            name: event.target.value,
          },
        });
      });
    }

    if (racerInput) {
      racerInput.addEventListener("input", (event) => {
        setState({
          racerForm: {
            ...state.racerForm,
            name: event.target.value,
          },
        });
      });
    }

    if (carInput) {
      carInput.addEventListener("input", (event) => {
        setState({
          racerForm: {
            ...state.racerForm,
            carNumber: event.target.value,
          },
        });
      });
    }

    if (saveSessionBtn) {
      saveSessionBtn.addEventListener("click", () => {
        const name = state.sessionForm.name.trim();
        if (!name) {
          setNotice("danger", "Session name is required.", 4000);
          return;
        }

        runAction(
          () => {
            if (state.sessionForm.id) {
              return apiRequest(`/api/sessions/${state.sessionForm.id}`, {
                method: "PATCH",
                body: { name },
              });
            }

            return apiRequest("/api/sessions", {
              method: "POST",
              body: { name },
            });
          },
          state.sessionForm.id ? "Session updated." : "Session created.",
          () => {
            setState({
              sessionForm: {
                id: null,
                name: "",
              },
            });
          }
        );
      });
    }

    if (cancelSessionEditBtn) {
      cancelSessionEditBtn.addEventListener("click", () => {
        setState({
          sessionForm: {
            id: null,
            name: "",
          },
        });
      });
    }

    if (saveRacerBtn) {
      saveRacerBtn.addEventListener("click", () => {
        if (!activeSession) {
          setNotice("danger", "Stage a session before adding racers.", 4000);
          return;
        }

        const name = state.racerForm.name.trim();
        if (!name) {
          setNotice("danger", "Racer name is required.", 4000);
          return;
        }

        const carNumber = state.racerForm.carNumber.trim();
        const body = {
          name,
          carNumber: carNumber === "" ? null : carNumber,
        };

        runAction(
          () => {
            if (state.racerForm.id) {
              return apiRequest(
                `/api/sessions/${activeSession.id}/racers/${state.racerForm.id}`,
                {
                  method: "PATCH",
                  body,
                }
              );
            }

            return apiRequest(`/api/sessions/${activeSession.id}/racers`, {
              method: "POST",
              body,
            });
          },
          state.racerForm.id ? "Racer updated." : "Racer added.",
          () => {
            setState({
              racerForm: {
                id: null,
                name: "",
                carNumber: "",
              },
            });
          }
        );
      });
    }

    if (cancelRacerEditBtn) {
      cancelRacerEditBtn.addEventListener("click", () => {
        setState({
          racerForm: {
            id: null,
            name: "",
            carNumber: "",
          },
        });
      });
    }

    document.querySelectorAll("[data-action='stage-session']").forEach((node) => {
      node.addEventListener("click", () => {
        runAction(
          () =>
            apiRequest("/api/race/session/select", {
              method: "POST",
              body: { sessionId: node.dataset.sessionId },
            }),
          "Session staged."
        );
      });
    });

    document.querySelectorAll("[data-action='edit-session']").forEach((node) => {
      node.addEventListener("click", () => {
        const session = state.raceSnapshot.sessions.find(
          (item) => item.id === node.dataset.sessionId
        );
        if (!session) {
          return;
        }

        setState({
          sessionForm: {
            id: session.id,
            name: session.name,
          },
        });
      });
    });

    document.querySelectorAll("[data-action='delete-session']").forEach((node) => {
      node.addEventListener("click", () => {
        runAction(
          () =>
            apiRequest(`/api/sessions/${node.dataset.sessionId}`, {
              method: "DELETE",
            }),
          "Session deleted."
        );
      });
    });

    document.querySelectorAll("[data-action='edit-racer']").forEach((node) => {
      node.addEventListener("click", () => {
        const racer = activeSession?.racers.find((item) => item.id === node.dataset.racerId);
        if (!racer) {
          return;
        }

        setState({
          racerForm: {
            id: racer.id,
            name: racer.name,
            carNumber: racer.carNumber || "",
          },
        });
      });
    });

    document.querySelectorAll("[data-action='delete-racer']").forEach((node) => {
      node.addEventListener("click", () => {
        if (!activeSession) {
          return;
        }

        runAction(
          () =>
            apiRequest(`/api/sessions/${activeSession.id}/racers/${node.dataset.racerId}`, {
              method: "DELETE",
            }),
          "Racer removed."
        );
      });
    });
  }

  function bindRaceControlEvents() {
    const startBtn = document.getElementById("race-start-btn");
    const finishBtn = document.getElementById("race-finish-btn");
    const lockBtn = document.getElementById("race-lock-btn");

    if (startBtn) {
      startBtn.addEventListener("click", () => {
        runAction(
          () =>
            apiRequest("/api/race/start", {
              method: "POST",
              body: {},
            }),
          "Race started."
        );
      });
    }

    if (finishBtn) {
      finishBtn.addEventListener("click", () => {
        runAction(
          () =>
            apiRequest("/api/race/finish", {
              method: "POST",
              body: {},
            }),
          "Race finished."
        );
      });
    }

    if (lockBtn) {
      lockBtn.addEventListener("click", () => {
        runAction(
          () =>
            apiRequest("/api/race/lock", {
              method: "POST",
              body: {},
            }),
          "Session locked."
        );
      });
    }

    document.querySelectorAll("[data-action='set-mode']").forEach((node) => {
      node.addEventListener("click", () => {
        runAction(
          () =>
            apiRequest("/api/race/mode", {
              method: "POST",
              body: { mode: node.dataset.mode },
            }),
          `${MODE_META[node.dataset.mode]?.label || node.dataset.mode} applied.`
        );
      });
    });
  }

  function bindLapTrackerEvents() {
    document.querySelectorAll("[data-action='lap-crossing']").forEach((node) => {
      node.addEventListener("click", () => {
        runAction(
          () =>
            apiRequest("/api/laps/crossing", {
              method: "POST",
              body: { racerId: node.dataset.racerId },
            }),
          "Lap crossing recorded.",
          () => {
            const activeSession = getActiveSession();
            const racer = activeSession?.racers.find((item) => item.id === node.dataset.racerId);
            if (racer) {
              setNotice("success", `Lap crossing recorded for ${racer.name}.`, 1800);
            }
          }
        );
      });
    });
  }

  function render() {
    appEl.innerHTML = appShell(buildContent());

    bindSharedEvents();

    if (routeConfig.staff) {
      bindStaffGate();
    }

    if (route === "/front-desk") {
      bindFrontDeskEvents();
    }

    if (route === "/race-control") {
      bindRaceControlEvents();
    }

    if (route === "/lap-line-tracker") {
      bindLapTrackerEvents();
    }

    if (routeConfig.public && !publicConnectStarted) {
      publicConnectStarted = true;
      connectSocket(undefined);
    }
  }

  document.addEventListener("fullscreenchange", render);

  loadBootstrap();
  render();

  window.RacetrackUI = {
    fullscreenButton,
    panel,
    telemetryHeader,
  };
})();
