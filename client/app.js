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
  const debugMode = new URLSearchParams(window.location.search).get("debug") === "1";
  const fullscreenEnabled = Boolean(document.fullscreenEnabled && document.documentElement.requestFullscreen);

  let socket = null;
  let publicConnectStarted = false;
  let staffBypassConnectStarted = false;
  let noticeTimer = null;
  let state = {
    bootstrap: null,
    bootstrapStatus: "loading",
    bootstrapError: "",
    staffAuthDisabled: false,
    connection: "idle",
    connectionDetail: "",
    reconnectAttempt: 0,
    error: "",
    serverHello: null,
    lastSyncAt: null,
    socketConnectedOnce: false,
    awaitingLiveResync: false,
    fullscreenError: "",
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

  function formatTimestamp(timestamp) {
    if (!timestamp) {
      return "Awaiting live sync";
    }

    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return "Awaiting live sync";
    }

    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
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
      sessions,
      leaderboard: Array.isArray(snapshot.leaderboard)
        ? sortLeaderboard(snapshot.leaderboard.map(normalizeLeaderboardEntry))
        : [],
    };
  }

  function getActiveSession() {
    return state.raceSnapshot.activeSession;
  }

  function getQueuedSessions() {
    return state.raceSnapshot.sessions.filter(
      (session) => session.id !== state.raceSnapshot.activeSessionId
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

  function hasRaceData() {
    return Boolean(state.lastSyncAt);
  }

  function isInitialPublicLoad() {
    return routeConfig.public && state.bootstrapStatus === "loading" && !hasRaceData();
  }

  function isFinishedState(snapshot = state.raceSnapshot) {
    return snapshot.state === "FINISHED";
  }

  function finishedClass(snapshot = state.raceSnapshot) {
    return isFinishedState(snapshot) ? " finished-pattern" : "";
  }

  function formatDeltaToLeader(entry, leaderBestLapMs) {
    if (!Number.isFinite(entry?.bestLapTimeMs) || !Number.isFinite(leaderBestLapMs)) {
      return "Benchmark pending";
    }

    const deltaMs = entry.bestLapTimeMs - leaderBestLapMs;
    if (deltaMs <= 0) {
      return "Benchmark lap";
    }

    return `+${(deltaMs / 1000).toFixed(3)}s`;
  }

  function routeTypeLabel(pathname) {
    if (pathname === "/") {
      return "Hub";
    }

    return ROUTES[pathname].staff ? "Staff" : "Public";
  }

  function routeCard(pathname) {
    const config = ROUTES[pathname];
    const tone = pathname === "/" ? "warning" : config.accent;

    return `
      <a class="route-card tone-${tone}" href="${escapeHtml(pathname)}">
        <div class="route-card-head">
          <span class="route-kind">${escapeHtml(routeTypeLabel(pathname))}</span>
          <span class="route-path">${escapeHtml(pathname)}</span>
        </div>
        <strong class="route-card-title">${escapeHtml(config.title)}</strong>
        <span class="route-card-note">${escapeHtml(config.subtitle)}</span>
        <p class="route-card-body">${escapeHtml(config.body)}</p>
      </a>
    `;
  }

  function routeDeck(title, detail, tone, paths, extraClass = "") {
    return panel(
      title,
      `
        <p class="panel-copy">${escapeHtml(detail)}</p>
        <div class="route-card-grid ${extraClass}">
          ${paths.map((pathname) => routeCard(pathname)).join("")}
        </div>
      `,
      tone
    );
  }

  function markSync(timestamp) {
    return timestamp || new Date().toISOString();
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
    const recoveredPublicFeed =
      routeConfig.public && state.socketConnectedOnce && state.awaitingLiveResync;

    setState({
      bootstrapStatus: "ready",
      bootstrapError: "",
      connection: socket?.connected ? "connected" : state.connection,
      lastSyncAt: markSync(snapshot?.serverTime ?? normalized.serverTime),
      socketConnectedOnce: socket?.connected ? true : state.socketConnectedOnce,
      awaitingLiveResync: false,
      raceSnapshot: normalized,
      sessionForm: nextSessionForm,
      racerForm: nextRacerForm,
    });

    if (recoveredPublicFeed) {
      setNotice("success", "Live feed restored. Board is back on the canonical snapshot.", 2200);
    }
  }

  function applyLeaderboardUpdate(payload) {
    if (!isObject(payload) || !Array.isArray(payload.leaderboard)) {
      return;
    }

    setState({
      lastSyncAt: markSync(payload.serverTime),
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
      lastSyncAt: markSync(payload.serverTime),
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
      const nextState = {
        bootstrap: data,
        bootstrapStatus: "ready",
        bootstrapError: "",
        staffAuthDisabled: Boolean(data.staffAuthDisabled),
        lastSyncAt: markSync(data.serverTime || data.raceSnapshot?.serverTime),
      };
      if (routeConfig.staff && data.staffAuthDisabled) {
        nextState.gateStatus = "success";
        nextState.gateError = "";
      }
      if (data.raceSnapshot) {
        nextState.raceSnapshot = normalizeSnapshot(data.raceSnapshot);
      }
      setState(nextState);
    } catch {
      setNotice("danger", "Bootstrap request failed.", 4000);
      setState({
        bootstrapStatus: "error",
        bootstrapError: "Bootstrap request failed.",
        error: "Bootstrap request failed.",
      });
    }
  }

  function getConnectionMeta() {
    if (staffGateRequired() && state.gateStatus !== "success") {
      if (state.gateStatus === "verifying") {
        return {
          label: "Awaiting key verification",
          detail: "The staff gate must succeed before the websocket can open.",
          tone: "warning",
        };
      }

      return {
        label: "Socket locked behind key gate",
        detail: "Realtime control stays blocked until the route key is verified.",
        tone: "idle",
      };
    }

    if (isInitialPublicLoad()) {
      return {
        label: "Loading race state",
        detail: "Fetching the first canonical board snapshot from the server.",
        tone: "connecting",
      };
    }

    if (state.connection === "connected" && state.awaitingLiveResync) {
      return {
        label: state.socketConnectedOnce ? "Resyncing live board" : "Syncing live board",
        detail:
          state.connectionDetail ||
          (state.socketConnectedOnce
            ? "Signal recovered. Confirming the latest canonical race snapshot now."
            : "Websocket connected. Confirming the live board snapshot now."),
        tone: "warning",
      };
    }

    if (state.connection === "connected") {
      return {
        label: "Live feed healthy",
        detail: routeConfig.public
          ? "Public screen is following server updates with websocket-only live data."
          : "Socket connected and staff controls are in sync.",
        tone: "safe",
      };
    }

    if (state.connection === "reconnecting") {
      return {
        label: `Reconnecting live feed${state.reconnectAttempt ? ` (${state.reconnectAttempt})` : ""}`,
        detail:
          state.connectionDetail ||
          (routeConfig.public
            ? "Holding the last confirmed race state while the websocket reconnects."
            : "Trying to restore the websocket session."),
        tone: "warning",
      };
    }

    if (state.connection === "connecting") {
      return {
        label: "Connecting live feed",
        detail: state.connectionDetail || "Opening the websocket channel for realtime race updates.",
        tone: "connecting",
      };
    }

    if (state.connection === "error") {
      return {
        label: "Live feed unavailable",
        detail:
          state.connectionDetail ||
          state.error ||
          "The websocket failed and could not recover automatically.",
        tone: "danger",
      };
    }

    return {
      label: "Socket idle",
      detail: "Waiting for the live connection to start.",
      tone: "idle",
    };
  }

  function staffGateRequired() {
    return routeConfig.staff && !state.staffAuthDisabled;
  }

  function staffReady() {
    if (!routeConfig.staff) {
      return false;
    }

    if (state.staffAuthDisabled) {
      return true;
    }

    return state.gateStatus === "success" && state.gateKey.trim() !== "";
  }

  function firstReason(...reasons) {
    return reasons.find((reason) => typeof reason === "string" && reason.trim() !== "") || "";
  }

  function staffAccessReason() {
    if (!routeConfig.staff) {
      return "Only staff routes can send commands.";
    }

    if (staffGateRequired() && state.gateStatus === "verifying") {
      return "Finish staff key verification before sending commands.";
    }

    if (staffGateRequired() && (state.gateStatus !== "success" || state.gateKey.trim() === "")) {
      return state.gateError || "Verify the staff key before sending commands.";
    }

    if (state.connection === "connecting") {
      return "Socket is still connecting.";
    }

    if (state.connection === "reconnecting") {
      return "Socket is reconnecting. Commands stay blocked until live sync returns.";
    }

    if (state.connection === "error") {
      return state.connectionDetail || state.error || "Socket connection failed.";
    }

    if (state.connection !== "connected" || !socket) {
      return "Socket is not connected.";
    }

    if (state.awaitingLiveResync) {
      return "Live controls are waiting for the next canonical snapshot.";
    }

    return "";
  }

  function buttonMarkup({
    id = "",
    label = "",
    innerHtml = "",
    variant = "primary",
    size = "default",
    disabled = false,
    active = false,
    attrs = "",
  }) {
    const classes = ["action-btn"];

    if (variant === "warning") {
      classes.push("action-warning");
    } else if (variant === "danger") {
      classes.push("action-danger");
    } else if (variant === "ghost") {
      classes.push("action-ghost");
    }

    if (size === "mini") {
      classes.push("mini-btn");
    }

    if (size === "huge-touch") {
      classes.push("huge-touch-btn");
    }

    if (active) {
      classes.push("is-active");
    }

    return `
      <button class="${classes.join(" ")}" ${id ? `id="${id}"` : ""} type="button" ${disabled ? "disabled" : ""} ${attrs}>
        ${innerHtml || escapeHtml(label)}
      </button>
    `;
  }

  function fullscreenButton() {
    const isFullscreen = Boolean(document.fullscreenElement);
    const label = isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen";
    const detail = fullscreenEnabled ? "Desktop + tablet ready" : "Fullscreen unavailable";

    return buttonMarkup({
      id: "fullscreen-btn",
      variant: "warning",
      active: isFullscreen,
      disabled: !fullscreenEnabled,
      innerHtml: `
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(detail)}</strong>
      `,
      attrs: 'data-action="toggle-fullscreen"',
    });
  }

  function connectionStatus() {
    const meta = getConnectionMeta();

    return `
      <div class="connection-status tone-${meta.tone}">
        <strong>${escapeHtml(meta.label)}</strong>
        <span>${escapeHtml(meta.detail)}</span>
        <em>Last sync ${escapeHtml(formatTimestamp(state.lastSyncAt))}</em>
      </div>
    `;
  }

  function telemetryHeader() {
    const snapshot = state.raceSnapshot;
    const flagMeta = getFlagMeta(snapshot);
    const routeTone = routeConfig.public ? "warning" : routeConfig.staff ? "safe" : "idle";
    const routeLabel = route === "/" ? "Launch Surface" : routeConfig.public ? "Public Display" : "Staff Operation";
    const phaseLabel = route === "/" ? "Control Hub" : STATE_META[snapshot.state]?.label || snapshot.state;

    return `
      <header class="telemetry-header">
        <div class="telemetry-copy">
          <p class="eyebrow">Beachside Racetrack</p>
          <div class="telemetry-title-row">
            <h1>${routeConfig.title}</h1>
            <div class="telemetry-tags">
              <span class="telemetry-tag tone-${routeTone}">${escapeHtml(routeLabel)}</span>
              <span class="telemetry-tag tone-${flagMeta.tone}">${escapeHtml(phaseLabel)}</span>
              ${debugMode ? '<span class="telemetry-tag tone-warning">Debug View</span>' : ""}
            </div>
          </div>
          <p class="subtitle">${routeConfig.subtitle}</p>
          <p class="route-caption">${routeConfig.body}</p>
        </div>
        <div class="telemetry-meta">
          ${connectionStatus()}
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
    if (!staffGateRequired() || state.gateStatus === "success") {
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
            ${buttonMarkup({
              id: "verify-btn",
              label: verifyLabel,
              disabled: state.gateStatus === "verifying",
            })}
          </div>
          <p class="error-text">${escapeHtml(state.gateError)}</p>
        </div>
      </div>
    `;
  }

  function appShell(content) {
    return `
      <div class="app-shell route-${route.replace(/\//g, "") || "home"} ${document.fullscreenElement ? "is-fullscreen" : ""}">
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

    return inlineAlert({
      tone: state.opNotice.tone,
      title: state.opNotice.tone === "success" ? "Update confirmed" : "Action needs attention",
      detail: state.opNotice.text,
    });
  }

  function kpiPill(label, value, tone = "safe") {
    return `
      <div class="kpi-pill tone-${tone}">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
    `;
  }

  function inlineAlert({ tone = "warning", title = "", detail = "" }) {
    return `
      <div class="inline-alert ${tone}">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(detail)}</span>
      </div>
    `;
  }

  function actionGuardList(items) {
    const blocked = items.filter((item) => item.reason);
    if (blocked.length === 0) {
      return "";
    }

    return `
      <div class="guard-list" aria-live="polite">
        ${blocked
          .map(
            (item) => `
              <div class="guard-item">
                <strong>${escapeHtml(item.label)}</strong>
                <span>${escapeHtml(item.reason)}</span>
              </div>
            `
          )
          .join("")}
      </div>
    `;
  }

  function staffConnectionAlert() {
    if (!routeConfig.staff || state.gateStatus !== "success") {
      return "";
    }

    const meta = getConnectionMeta();
    if (
      state.connection !== "reconnecting" &&
      state.connection !== "error" &&
      !state.awaitingLiveResync
    ) {
      return "";
    }

    return inlineAlert({
      tone: meta.tone === "danger" ? "danger" : "warning",
      title: meta.label,
      detail: meta.detail,
    });
  }

  function emptyState(title, detail) {
    return `
      <div class="empty-state">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(detail)}</span>
      </div>
    `;
  }

  function loadingSkeleton(lines = 3) {
    return `
      <div class="loading-skeleton" aria-hidden="true">
        ${Array.from({ length: lines }, (_unused, index) => {
          const widths = ["100%", "82%", "64%", "92%"];
          return `<span class="skeleton-line" style="width:${widths[index % widths.length]}"></span>`;
        }).join("")}
      </div>
    `;
  }

  function divider() {
    return '<div class="divider" role="presentation"></div>';
  }

  function dataTable(headers, rows, { compact = false } = {}) {
    return `
      <div class="table-wrap">
        <table class="telemetry-table ${compact ? "compact" : ""}">
          <thead>
            <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
          </thead>
          <tbody>${rows.join("")}</tbody>
        </table>
      </div>
    `;
  }

  function summaryPanel() {
    const snapshot = state.raceSnapshot;
    const activeSession = getActiveSession();
    const queuedCount = getQueuedSessions().length;
    const flagMeta = getFlagMeta(snapshot);

    return panel(
      "Race Overview",
      `
        <div class="overview-shell">
          <div class="overview-copy">
            <p class="section-kicker">Live launch hub</p>
            <strong class="overview-title">${escapeHtml(STATE_META[snapshot.state]?.label || snapshot.state)}</strong>
            <p class="panel-copy">Open a staff surface to operate the race or a public surface to present the current live state. The hub stays intentionally concise.</p>
          </div>
          <div class="kpi-grid">
            ${kpiPill("Flag", flagMeta.label, flagMeta.tone)}
            ${kpiPill("Active Session", activeSession ? activeSession.name : "None staged", activeSession ? "warning" : "danger")}
            ${kpiPill("Queued Sessions", String(queuedCount), queuedCount ? "warning" : "safe")}
            ${kpiPill("Route Count", String(Object.keys(ROUTES).length), "safe")}
          </div>
        </div>
      `,
      flagMeta.tone,
      "panel-wide"
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
      "Debug Runtime",
      `
        <p class="panel-copy">Visible only when the route is opened with <code>?debug=1</code>.</p>
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
    const syncLabel = state.awaitingLiveResync ? "waiting" : "live";
    return panel(
      "Control State",
      `
        <div class="status-marquee tone-${flagMeta.tone}">
          <div class="status-marquee-copy">
            <p class="section-kicker">Live authority</p>
            <strong class="status-marquee-title">${escapeHtml(STATE_META[snapshot.state]?.label || snapshot.state)}</strong>
            <span class="status-marquee-detail">${escapeHtml(flagMeta.detail)}</span>
            <div class="telemetry-tags">
              <span class="telemetry-tag tone-${flagMeta.tone}">${escapeHtml(MODE_META[snapshot.mode]?.label || snapshot.mode)}</span>
              <span class="telemetry-tag tone-${activeSession ? "warning" : "idle"}">${escapeHtml(activeSession ? activeSession.name : "No active session")}</span>
            </div>
          </div>
          <div class="kpi-grid">
            ${kpiPill("Countdown", formatTime(snapshot.remainingSeconds), "danger")}
            ${kpiPill("Racers", String(activeSession ? activeSession.racers.length : 0), activeSession ? "safe" : "danger")}
            ${kpiPill("Socket", state.connection.toUpperCase(), state.connection === "connected" ? "safe" : "danger")}
            ${kpiPill("Sync", syncLabel.toUpperCase(), syncLabel === "live" ? "safe" : "warning")}
          </div>
        </div>
        ${staffConnectionAlert()}
        ${noticeMarkup()}
        <div class="chip-row">
          <span class="chip">Gate: ${escapeHtml(state.staffAuthDisabled ? "bypassed" : state.gateStatus)}</span>
          <span class="chip">Sync: ${escapeHtml(syncLabel)}</span>
          <span class="chip">Last sync: ${escapeHtml(formatTimestamp(state.lastSyncAt))}</span>
        </div>
      `,
      "safe",
      "panel-wide"
    );
  }

  function requestHeaders() {
    return {
      "Content-Type": "application/json",
      "x-staff-route": route,
      ...(state.gateKey.trim() ? { "x-staff-key": state.gateKey.trim() } : {}),
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
    const accessReason = staffAccessReason();
    if (accessReason) {
      throw new Error(accessReason);
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
        const accessReason = staffAccessReason();
        const stageReason = firstReason(
          accessReason,
          state.pending ? "Wait for the current request to finish." : "",
          active ? "This session is already active." : "",
          state.raceSnapshot.state === "RUNNING" || state.raceSnapshot.state === "FINISHED"
            ? "Staging is blocked while the race is RUNNING or FINISHED."
            : ""
        );
        const editReason = firstReason(
          accessReason,
          state.pending ? "Wait for the current request to finish." : "",
          active &&
            (state.raceSnapshot.state === "RUNNING" || state.raceSnapshot.state === "FINISHED")
            ? "Active session edits lock once the race is RUNNING or FINISHED."
            : ""
        );
        const deleteReason = editReason;
        const summaryReason = firstReason(stageReason, editReason, deleteReason);

        return `
          <tr>
            <td>${escapeHtml(session.name)}</td>
            <td>${active ? '<span class="chip tiny-chip">ACTIVE</span>' : '<span class="chip tiny-chip">QUEUED</span>'}</td>
            <td>${session.racers.length}</td>
            <td>
              <div class="row-actions">
                ${buttonMarkup({
                  label: "Stage",
                  variant: "ghost",
                  size: "mini",
                  disabled: Boolean(stageReason),
                  attrs: `data-action="stage-session" data-session-id="${escapeHtml(session.id)}"`,
                })}
                ${buttonMarkup({
                  label: "Edit",
                  variant: "ghost",
                  size: "mini",
                  disabled: Boolean(editReason),
                  attrs: `data-action="edit-session" data-session-id="${escapeHtml(session.id)}"`,
                })}
                ${buttonMarkup({
                  label: "Delete",
                  variant: "danger",
                  size: "mini",
                  disabled: Boolean(deleteReason),
                  attrs: `data-action="delete-session" data-session-id="${escapeHtml(session.id)}"`,
                })}
              </div>
              ${summaryReason ? `<p class="row-reason">${escapeHtml(summaryReason)}</p>` : ""}
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
    const accessReason = staffAccessReason();

    return activeSession.racers
      .map((racer) => {
        const editReason = firstReason(
          accessReason,
          state.pending ? "Wait for the current request to finish." : "",
          editBlocked ? "Racer edits lock once the race is RUNNING or FINISHED." : ""
        );

        return `
          <tr>
            <td>${escapeHtml(racer.name)}</td>
            <td>${escapeHtml(racer.carNumber || "--")}</td>
            <td>${racer.lapCount}</td>
            <td>
              <div class="row-actions">
                ${buttonMarkup({
                  label: "Edit",
                  variant: "ghost",
                  size: "mini",
                  disabled: Boolean(editReason),
                  attrs: `data-action="edit-racer" data-racer-id="${escapeHtml(racer.id)}"`,
                })}
                ${buttonMarkup({
                  label: "Delete",
                  variant: "danger",
                  size: "mini",
                  disabled: Boolean(editReason),
                  attrs: `data-action="delete-racer" data-racer-id="${escapeHtml(racer.id)}"`,
                })}
              </div>
              ${editReason ? `<p class="row-reason">${escapeHtml(editReason)}</p>` : ""}
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function getFrontDeskFormState() {
    const activeSession = getActiveSession();
    const updateMode = state.sessionForm.id !== null;
    const racerUpdateMode = state.racerForm.id !== null;
    const accessReason = staffAccessReason();
    const activeEditable =
      activeSession &&
      state.raceSnapshot.state !== "RUNNING" &&
      state.raceSnapshot.state !== "FINISHED";
    const saveSessionReason = firstReason(
      accessReason,
      state.pending ? "Wait for the current request to finish." : "",
      state.sessionForm.name.trim() ? "" : "Enter a session name."
    );
    const racerEditReason = firstReason(
      accessReason,
      state.pending ? "Wait for the current request to finish." : "",
      activeSession ? "" : "Create or stage a session before adding racers.",
      activeEditable ? "" : "Racer edits lock once the race is RUNNING or FINISHED."
    );
    const saveRacerReason = firstReason(
      racerEditReason,
      state.racerForm.name.trim() ? "" : "Enter a racer name."
    );
    const frontDeskReasons = actionGuardList([
      { label: updateMode ? "Save Session" : "Create Session", reason: saveSessionReason },
      { label: racerUpdateMode ? "Save Racer" : "Add Racer", reason: saveRacerReason },
    ]);

    return {
      activeSession,
      updateMode,
      racerUpdateMode,
      saveSessionReason,
      racerEditReason,
      saveRacerReason,
      frontDeskReasons,
    };
  }

  function frontDeskPanel() {
    const formState = getFrontDeskFormState();
    const activeSession = formState.activeSession;

    return [
      panel(
        "Session Setup",
        `
          <div class="ops-board">
            <div class="form-stack">
              <p class="section-kicker">Session control</p>
              <label class="field">
                <span>Session name</span>
                <input id="session-name-input" type="text" value="${escapeHtml(state.sessionForm.name)}" placeholder="Evening Heat" />
              </label>
              <div class="controls">
                ${buttonMarkup({
                  id: "save-session-btn",
                  label: formState.updateMode ? "Save Session" : "Create Session",
                  disabled: Boolean(formState.saveSessionReason),
                })}
                ${formState.updateMode ? buttonMarkup({ id: "cancel-session-edit-btn", label: "Cancel", variant: "ghost" }) : ""}
              </div>
            </div>
            <div class="summary-stack">
              <p class="section-kicker">Staged session</p>
              <strong class="summary-value">${escapeHtml(activeSession ? activeSession.name : "No active session")}</strong>
              <div class="stack-list compact-list">
                <div class="info-row"><span>Race state</span><strong>${escapeHtml(STATE_META[state.raceSnapshot.state]?.label || state.raceSnapshot.state)}</strong></div>
                <div class="info-row"><span>Racers</span><strong>${activeSession ? activeSession.racers.length : 0}</strong></div>
                <div class="info-row"><span>Queued sessions</span><strong>${getQueuedSessions().length}</strong></div>
              </div>
            </div>
          </div>
          <div id="front-desk-guards">
            ${formState.frontDeskReasons}
          </div>
        `,
        "safe"
      ),
      panel(
        "Session Queue",
        dataTable(["Session", "Status", "Racers", "Actions"], [sessionRows()], { compact: true }),
        "warning"
      ),
      panel(
        "Racer Garage",
        `
          <div class="ops-board racer-board">
            <label class="field">
              <span>Racer name</span>
              <input id="racer-name-input" type="text" value="${escapeHtml(state.racerForm.name)}" placeholder="Driver Name" ${formState.racerEditReason ? "disabled" : ""} />
            </label>
            <label class="field">
              <span>Car number</span>
              <input id="car-number-input" type="text" value="${escapeHtml(state.racerForm.carNumber)}" placeholder="7" ${formState.racerEditReason ? "disabled" : ""} />
            </label>
            <div class="controls">
              ${buttonMarkup({
                id: "save-racer-btn",
                label: formState.racerUpdateMode ? "Save Racer" : "Add Racer",
                disabled: Boolean(formState.saveRacerReason),
              })}
              ${formState.racerUpdateMode ? buttonMarkup({ id: "cancel-racer-edit-btn", label: "Cancel", variant: "ghost" }) : ""}
            </div>
          </div>
          <p id="racer-edit-hint" class="hint">${escapeHtml(formState.racerEditReason || "Racer edits apply to the active staged session.")}</p>
          ${dataTable(["Racer", "Car", "Laps", "Actions"], [racerRows(formState.activeSession)], { compact: true })}
        `,
        "safe",
        "panel-wide"
      ),
    ].join("");
  }

  function syncFrontDeskFormUi() {
    if (route !== "/front-desk") {
      return;
    }

    const formState = getFrontDeskFormState();
    const saveSessionBtn = document.getElementById("save-session-btn");
    const saveRacerBtn = document.getElementById("save-racer-btn");
    const racerInput = document.getElementById("racer-name-input");
    const carInput = document.getElementById("car-number-input");
    const guards = document.getElementById("front-desk-guards");
    const racerHint = document.getElementById("racer-edit-hint");

    if (saveSessionBtn) {
      saveSessionBtn.disabled = Boolean(formState.saveSessionReason);
    }

    if (saveRacerBtn) {
      saveRacerBtn.disabled = Boolean(formState.saveRacerReason);
    }

    if (racerInput) {
      racerInput.disabled = Boolean(formState.racerEditReason);
    }

    if (carInput) {
      carInput.disabled = Boolean(formState.racerEditReason);
    }

    if (guards) {
      guards.innerHTML = formState.frontDeskReasons;
    }

    if (racerHint) {
      racerHint.textContent =
        formState.racerEditReason || "Racer edits apply to the active staged session.";
    }
  }

  function leaderboardTable(entries) {
    if (isInitialPublicLoad()) {
      return loadingSkeleton(5);
    }

    if (entries.length === 0) {
      return emptyState(
        "Leaderboard waiting for the first lap",
        "As soon as lap crossings arrive, positions and best laps will populate here."
      );
    }

    const leaderBestLapMs =
      entries.find((entry) => Number.isFinite(entry.bestLapTimeMs))?.bestLapTimeMs ?? null;

    return dataTable(
      ["Pos", "Car", "Racer", "Best Lap", "Live Lap", "Laps"],
      entries.map(
        (entry) => `
          <tr class="${entry.position === 1 ? "leader-row" : ""}">
            <td><span class="position-badge">${entry.position}</span></td>
            <td><span class="car-badge">${escapeHtml(entry.carNumber || "--")}</span></td>
            <td>
              <div class="driver-cell">
                <strong>${escapeHtml(entry.name)}</strong>
                <span>${escapeHtml(formatDeltaToLeader(entry, leaderBestLapMs))}</span>
              </div>
            </td>
            <td class="timing-cell ${entry.bestLapTimeMs === leaderBestLapMs ? "is-best" : ""}">${escapeHtml(formatLap(entry.bestLapTimeMs))}</td>
            <td class="timing-cell">${escapeHtml(formatLap(entry.currentLapTimeMs))}</td>
            <td class="timing-cell">${entry.lapCount}</td>
          </tr>
        `
      )
    );
  }

  function raceControlPanel() {
    const snapshot = state.raceSnapshot;
    const activeSession = getActiveSession();
    const accessReason = staffAccessReason();
    const flagMeta = getFlagMeta(snapshot);
    const startReason = firstReason(
      accessReason,
      state.pending ? "Wait for the current request to finish." : "",
      activeSession ? "" : "Stage a session before starting the race.",
      snapshot.state === "STAGING" ? "" : "Start Race is only available from STAGING."
    );
    const finishReason = firstReason(
      accessReason,
      state.pending ? "Wait for the current request to finish." : "",
      snapshot.state === "RUNNING" ? "" : "Finish Race is only available while RUNNING."
    );
    const lockReason = firstReason(
      accessReason,
      state.pending ? "Wait for the current request to finish." : "",
      snapshot.state === "FINISHED" ? "" : "End + Lock is only available after FINISHED."
    );
    const modeReason = firstReason(
      accessReason,
      state.pending ? "Wait for the current request to finish." : "",
      snapshot.state === "RUNNING" ? "" : "Mode changes are only available while RUNNING."
    );

    const modeButtons = RACE_CONTROL_MODES.map((mode) => {
      const active = snapshot.mode === mode;
      return buttonMarkup({
        label: MODE_META[mode].label,
        variant: "ghost",
        active,
        disabled: Boolean(modeReason),
        attrs: `data-action="set-mode" data-mode="${mode}"`,
      });
    }).join("");

    return [
      panel(
        "Lifecycle Commands",
        `
          <div class="command-stage tone-${flagMeta.tone}">
            <div class="command-stage-copy">
              <p class="section-kicker">Current authority</p>
              <strong class="command-stage-title">${escapeHtml(STATE_META[snapshot.state]?.label || snapshot.state)}</strong>
              <span class="command-stage-detail">${escapeHtml(activeSession ? activeSession.name : "No session staged")}</span>
            </div>
            <div class="controls controls-tight command-row">
              ${buttonMarkup({ id: "race-start-btn", label: "Start Race", disabled: Boolean(startReason) })}
              ${buttonMarkup({ id: "race-finish-btn", label: "Finish Race", variant: "warning", disabled: Boolean(finishReason) })}
              ${buttonMarkup({ id: "race-lock-btn", label: "End + Lock", variant: "danger", disabled: Boolean(lockReason) })}
            </div>
          </div>
          ${actionGuardList([
            { label: "Start Race", reason: startReason },
            { label: "Finish Race", reason: finishReason },
            { label: "End + Lock", reason: lockReason },
          ])}
        `,
        "warning"
      ),
      panel(
        "Mode Control",
        `
          <p class="panel-copy">Flag mode changes stay available only while the race is live. The current state remains visually pinned above.</p>
          ${actionGuardList([{ label: "Mode controls", reason: modeReason }])}
          <div class="mode-grid">${modeButtons}</div>
        `,
        flagMeta.tone
      ),
      panel("Live Order", leaderboardTable(snapshot.leaderboard), "safe", "panel-wide"),
    ].join("");
  }

  function lapTrackerPanel() {
    const snapshot = state.raceSnapshot;
    const activeSession = getActiveSession();
    const lapAllowed = snapshot.state === "RUNNING" || snapshot.state === "FINISHED";
    const flagMeta = getFlagMeta(snapshot);
    const lapReason = firstReason(
      staffAccessReason(),
      state.pending ? "Wait for the current request to finish." : "",
      activeSession ? "" : "Stage a session before lap entry.",
      lapAllowed ? "" : "Lap entry is only available while RUNNING or FINISHED."
    );
    const racers = activeSession ? activeSession.racers : [];

    const buttons = racers.length
      ? racers
          .map(
            (racer) => `
              ${buttonMarkup({
                variant: "danger",
                size: "huge-touch",
                disabled: Boolean(lapReason),
                attrs: `data-action="lap-crossing" data-racer-id="${escapeHtml(racer.id)}"`,
                innerHtml: `
                <span>${escapeHtml(racer.carNumber || "Car")}</span>
                <strong>${escapeHtml(racer.name)}</strong>
                <em>Laps ${racer.lapCount}</em>
                `,
              })}
            `
          )
          .join("")
      : emptyState(
          "No staged racers available",
          "Stage a session first, then lap tracker buttons will appear here."
        );

    const overlay =
      snapshot.state === "LOCKED"
        ? '<div class="session-overlay">Session is LOCKED. Lap input is blocked.</div>'
        : "";

    return [
      panel(
        "Lap Entry Status",
        `
          <div class="lap-stage tone-${flagMeta.tone}">
            <div class="lap-stage-copy">
              <p class="section-kicker">Authoritative entry</p>
              <strong class="command-stage-title">${escapeHtml(activeSession ? activeSession.name : "Awaiting staged session")}</strong>
              <span class="command-stage-detail">${escapeHtml(STATE_META[snapshot.state]?.detail || "Lap entry will unlock when the race enters a live phase.")}</span>
            </div>
            <div class="telemetry-tags">
              <span class="telemetry-tag tone-${flagMeta.tone}">${escapeHtml(flagMeta.label)}</span>
              <span class="telemetry-tag tone-${lapAllowed ? "safe" : "danger"}">${escapeHtml(lapAllowed ? "Lap entry open" : "Lap entry blocked")}</span>
            </div>
          </div>
          ${actionGuardList([{ label: "Lap crossing", reason: lapReason }])}
        `,
        "danger"
      ),
      panel(
        "Crossing Console",
        `
          <div class="car-grid lap-grid">${buttons}</div>
          ${overlay}
        `,
        "danger",
        "panel-wide"
      ),
    ].join("");
  }

  function publicStatusPanel() {
    const snapshot = state.raceSnapshot;
    const flagMeta = getFlagMeta(snapshot);
    const activeSession = getActiveSession();
    const connectionMeta = getConnectionMeta();
    const syncBanner =
      state.connection === "reconnecting" || state.awaitingLiveResync || state.connection === "error"
        ? inlineAlert({
            tone:
              state.connection === "error"
                ? "danger"
                : state.awaitingLiveResync
                  ? "warning"
                  : "warning",
            title: connectionMeta.label,
            detail: connectionMeta.detail,
          })
        : "";
    const fullscreenBanner = state.fullscreenError
      ? inlineAlert({
          tone: "danger",
          title: "Fullscreen needs manual recovery",
          detail: state.fullscreenError,
        })
      : "";
    const confidenceMarkup = `
      <div class="confidence-row">
        <span class="chip">Last sync ${escapeHtml(formatTimestamp(state.lastSyncAt))}</span>
        <span class="chip">${routeConfig.public ? "No polling" : "Socket only"}</span>
        <span class="chip">${escapeHtml(state.socketConnectedOnce ? "Resync ready" : "First sync pending")}</span>
      </div>
    `;

    return panel(
      "Live State",
      `
        <div class="public-state-shell">
          <div class="public-state-copy">
            <p class="section-kicker">Presentation mode</p>
            <strong class="overview-title">${escapeHtml(flagMeta.label)}</strong>
            <span class="public-state-detail">${escapeHtml(activeSession ? activeSession.name : "No active session")}</span>
          </div>
          <div class="kpi-grid">
            ${kpiPill("Phase", STATE_META[snapshot.state]?.label || snapshot.state, STATE_META[snapshot.state]?.tone || "safe")}
            ${kpiPill("Countdown", formatTime(snapshot.remainingSeconds), "danger")}
            ${kpiPill("Sync", state.awaitingLiveResync ? "PENDING" : "LIVE", state.awaitingLiveResync ? "warning" : "safe")}
            ${kpiPill("Rows", String(snapshot.leaderboard.length), snapshot.leaderboard.length ? "safe" : "warning")}
          </div>
        </div>
        ${syncBanner}
        ${fullscreenBanner}
        ${confidenceMarkup}
        <p class="hint">${escapeHtml(flagMeta.detail)}</p>
      `,
      flagMeta.tone,
      `panel-wide${finishedClass(snapshot)}`
    );
  }

  function activeRosterTable(session) {
    if (isInitialPublicLoad()) {
      return loadingSkeleton(4);
    }

    if (!session || session.racers.length === 0) {
      return emptyState(
        "No racers staged",
        "When a session is staged, the current roster will appear here."
      );
    }

    return dataTable(
      ["Racer", "Car", "Laps", "Best"],
      session.racers.map(
        (racer) => `
          <tr>
            <td>${escapeHtml(racer.name)}</td>
            <td>${escapeHtml(racer.carNumber || "--")}</td>
            <td>${racer.lapCount}</td>
            <td>${escapeHtml(formatLap(racer.bestLapTimeMs))}</td>
          </tr>
        `
      ),
      { compact: true }
    );
  }

  function leaderBoardPanels() {
    const activeSession = getActiveSession();
    const leader = state.raceSnapshot.leaderboard[0] || null;
    const flagMeta = getFlagMeta();
    return [
      panel(
        "Timing Tower",
        `
          <div class="tower-hero${finishedClass()}">
            <div class="tower-hero-copy">
              <p class="section-kicker">Current benchmark</p>
              <strong class="tower-hero-title">${escapeHtml(leader ? leader.name : "Waiting for first lap")}</strong>
              <span class="tower-hero-detail">${escapeHtml(activeSession ? activeSession.name : "No active session")}</span>
            </div>
            <div class="tower-stat">
              <span>Best lap</span>
              <strong>${escapeHtml(leader ? formatLap(leader.bestLapTimeMs) : "--")}</strong>
            </div>
            <div class="tower-stat">
              <span>Car</span>
              <strong>${escapeHtml(leader?.carNumber || "--")}</strong>
            </div>
          </div>
          <div class="tower-caption">${escapeHtml(flagMeta.detail)}</div>
          ${leaderboardTable(state.raceSnapshot.leaderboard)}
        `,
        flagMeta.tone,
        `panel-wide${finishedClass()}`
      ),
    ].join("");
  }

  function nextRacePanels() {
    const activeSession = getActiveSession();
    const queued = getQueuedSessions()[0] || null;
    const flagMeta = getFlagMeta();

    return [
      panel(
        "Track Window",
        `
          <div class="event-marquee${finishedClass()}">
            <div>
              <p class="section-kicker">Current session</p>
              <strong class="overview-title">${escapeHtml(activeSession ? activeSession.name : "No active session")}</strong>
              <span class="public-state-detail">${escapeHtml(flagMeta.detail)}</span>
            </div>
            <div class="tower-stat">
              <span>Racers</span>
              <strong>${activeSession ? activeSession.racers.length : 0}</strong>
            </div>
            <div class="tower-stat">
              <span>State</span>
              <strong>${escapeHtml(STATE_META[state.raceSnapshot.state]?.label || state.raceSnapshot.state)}</strong>
            </div>
          </div>
        `,
        "warning",
        `panel-wide${finishedClass()}`
      ),
      panel("Current Lineup", activeRosterTable(activeSession), "warning"),
      panel(
        "Next On Deck",
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
        "Race Countdown",
        `
          <div class="countdown-shell tone-${escapeHtml(flagMeta.tone)}${finishedClass()}">
            <div class="countdown-board tone-${escapeHtml(flagMeta.tone)}${finishedClass()}">
              <p class="section-kicker">Official timer</p>
              <div class="countdown-digits">${escapeHtml(formatTime(state.raceSnapshot.remainingSeconds))}</div>
              <p class="hero-copy">${escapeHtml(STATE_META[state.raceSnapshot.state]?.detail || "")}</p>
            </div>
            <div class="countdown-side">
              <span class="telemetry-tag tone-${flagMeta.tone}">${escapeHtml(flagMeta.label)}</span>
              <strong>${escapeHtml(activeSession ? activeSession.name : "No active session")}</strong>
              <span>${escapeHtml(MODE_META[state.raceSnapshot.mode]?.label || state.raceSnapshot.mode)}</span>
            </div>
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
        "Track State Board",
        `
          <div class="flag-shell">
            <div class="flag-board tone-${escapeHtml(flagMeta.tone)}${finishedClass()}">
              <span class="flag-code">${escapeHtml(flagMeta.label.toUpperCase())}</span>
              <strong>${escapeHtml(STATE_META[state.raceSnapshot.state]?.label || state.raceSnapshot.state)}</strong>
              <p>${escapeHtml(flagMeta.detail)}</p>
              <span class="flag-timer">${escapeHtml(formatTime(state.raceSnapshot.remainingSeconds))}</span>
            </div>
            <div class="flag-detail-panel">
              <p class="section-kicker">Track summary</p>
              <strong>${escapeHtml(getActiveSession() ? getActiveSession().name : "No active session")}</strong>
              <span>${escapeHtml(MODE_META[state.raceSnapshot.mode]?.label || state.raceSnapshot.mode)}</span>
              <span>${escapeHtml(`${state.raceSnapshot.leaderboard.length} leaderboard rows`)}</span>
            </div>
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
      routeDeck("Hub", "The root route stays a lightweight launch surface for the full telemetry shell.", "warning", ["/"], "single-card-grid"),
      routeDeck(
        "Staff Routes",
        "Operational screens for setup, lifecycle control, and authoritative lap entry.",
        "safe",
        ["/front-desk", "/race-control", "/lap-line-tracker"]
      ),
      routeDeck(
        "Public Displays",
        "Fullscreen-friendly presentation routes for live boards, timing, and state display.",
        "warning",
        ["/leader-board", "/next-race", "/race-countdown", "/race-flags"]
      ),
    ].join("");
  }

  function buildContent() {
    if (routeConfig.public && state.bootstrapStatus === "error" && !hasRaceData()) {
      return panel(
        "Live Feed Unavailable",
        `
          ${inlineAlert({
            tone: "danger",
            title: "The public board could not load",
            detail: state.bootstrapError || state.error || "No bootstrap or websocket data is available yet.",
          })}
          ${emptyState(
            "Waiting for a usable race snapshot",
            "Keep this screen open. As soon as bootstrap or websocket state becomes available, the board will recover without polling."
          )}
        `,
        "danger",
        "panel-wide"
      );
    }

    if (route === "/front-desk") {
      return [staffStatusPanel(), frontDeskPanel(), debugMode ? runtimePanel() : ""].join("");
    }

    if (route === "/race-control") {
      return [staffStatusPanel(), raceControlPanel(), debugMode ? runtimePanel() : ""].join("");
    }

    if (route === "/lap-line-tracker") {
      return [staffStatusPanel(), lapTrackerPanel(), debugMode ? runtimePanel() : ""].join("");
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
        if (!fullscreenEnabled) {
          setState({ fullscreenError: "Fullscreen is not supported in this browser." });
          setNotice("danger", "Fullscreen is not supported in this browser.", 3200);
          return;
        }

        try {
          if (document.fullscreenElement && document.exitFullscreen) {
            await document.exitFullscreen();
          } else {
            await document.documentElement.requestFullscreen({ navigationUI: "hide" });
          }
          setState({ fullscreenError: "" });
        } catch {
          setState({
            fullscreenError: "Fullscreen request was blocked by the browser.",
          });
          setNotice(
            "danger",
            "Fullscreen request was blocked. Retry from a direct tap or click.",
            3600
          );
        }
      });
    });
  }

  function connectSocket(key) {
    if (socket) {
      socket.disconnect();
      socket = null;
    }

    setState({
      connection: state.socketConnectedOnce ? "reconnecting" : "connecting",
      connectionDetail: routeConfig.staff
        ? "Opening the staff realtime channel."
        : "Opening the public realtime channel.",
      reconnectAttempt: 0,
      error: "",
      awaitingLiveResync: false,
    });
    socket = window.io({
      auth: { route, key },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 600,
      reconnectionDelayMax: 1600,
    });

    socket.on("connect", () => {
      setState({
        connection: "connected",
        connectionDetail: routeConfig.staff
          ? "Socket restored. Waiting for the next canonical snapshot."
          : "",
        reconnectAttempt: 0,
        error: "",
        awaitingLiveResync: true,
      });
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
      const message = err?.message || "Socket connection failed.";
      if (routeConfig.staff && message === "AUTH_INVALID") {
        if (socket) {
          socket.disconnect();
          socket = null;
        }

        setState({
          connection: "idle",
          connectionDetail: "",
          reconnectAttempt: 0,
          error: "",
          gateStatus: "error",
          gateKey: "",
          gateError: "Stored staff key was rejected. Verify again to reconnect.",
          awaitingLiveResync: false,
        });
        setNotice("danger", "Staff route locked again. Re-verify the access key.", 4200);
        return;
      }

      const nextConnection = socket?.active ? "reconnecting" : "error";
      setState({
        connection: nextConnection,
        connectionDetail:
          nextConnection === "reconnecting"
            ? "Socket could not reconnect cleanly yet."
            : "Socket could not reconnect cleanly.",
        error: message,
        awaitingLiveResync: false,
      });
    });

    socket.on("disconnect", (reason) => {
      if (routeConfig.staff && staffReady() && reason !== "io client disconnect") {
        setState({
          connection: "reconnecting",
          connectionDetail:
            "Connection dropped. Waiting for automatic reconnect and fresh sync.",
          error: "",
          awaitingLiveResync: false,
        });
        return;
      }

      setState({
        connection: routeConfig.public || state.socketConnectedOnce ? "reconnecting" : "idle",
        connectionDetail:
          routeConfig.public || state.socketConnectedOnce
            ? "Holding the last confirmed race state while the websocket reconnects."
            : "",
        error:
          reason === "io server disconnect"
            ? "Server closed the live feed."
            : "Signal dropped. Trying to reconnect.",
        awaitingLiveResync: false,
      });
    });

    socket.io.on("reconnect_attempt", (attempt) => {
      setState({
        connection: "reconnecting",
        connectionDetail:
          routeConfig.staff
            ? `Reconnect attempt ${attempt} in progress.`
            : "Holding the last confirmed race state while the websocket reconnects.",
        reconnectAttempt: attempt,
        awaitingLiveResync: false,
      });
    });

    socket.io.on("reconnect_failed", () => {
      setState({
        connection: "error",
        connectionDetail: "Automatic reconnect stopped after repeated failures.",
        error: "Live feed could not reconnect after multiple attempts.",
        awaitingLiveResync: false,
      });
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
        state = {
          ...state,
          sessionForm: {
            ...state.sessionForm,
            name: event.target.value,
          },
        };
        syncFrontDeskFormUi();
      });
    }

    if (racerInput) {
      racerInput.addEventListener("input", (event) => {
        state = {
          ...state,
          racerForm: {
            ...state.racerForm,
            name: event.target.value,
          },
        };
        syncFrontDeskFormUi();
      });
    }

    if (carInput) {
      carInput.addEventListener("input", (event) => {
        state = {
          ...state,
          racerForm: {
            ...state.racerForm,
            carNumber: event.target.value,
          },
        };
        syncFrontDeskFormUi();
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

    if (staffGateRequired()) {
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

    if (routeConfig.staff && state.staffAuthDisabled && !staffBypassConnectStarted) {
      staffBypassConnectStarted = true;
      connectSocket(undefined);
    }
  }

  document.addEventListener("fullscreenchange", render);
  document.addEventListener("fullscreenerror", () => {
    setState({
      fullscreenError: "Fullscreen failed to change state.",
    });
  });

  loadBootstrap();
  render();

  window.RacetrackUI = {
    fullscreenButton,
    panel,
    telemetryHeader,
  };
})();
