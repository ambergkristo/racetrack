// Generated from client/src. Run `npm run sync:client` after editing source modules.
(async () => {
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
      body: "",
    },
    "/race-control": {
      title: "Race Control",
      subtitle: "Lifecycle and mode controls",
      staff: true,
      public: false,
      accent: "warning",
      body: "Call the race state quickly and keep the active mode visible at a glance.",
    },
    "/lap-line-tracker": {
      title: "Lap Line Tracker",
      subtitle: "Authoritative lap entry",
      staff: true,
      public: false,
      accent: "danger",
      body: "Record crossings fast with large touch targets and only the state that matters.",
    },
    "/leader-board": {
      title: "Leader Board",
      subtitle: "Who is leading right now?",
      staff: false,
      public: true,
      accent: "safe",
      body: "Fast timing tower for guests and racers, focused on position, leader pace, and live race state.",
    },
    "/next-race": {
      title: "Next Race",
      subtitle: "Who is on track now, and who is up next?",
      staff: false,
      public: true,
      accent: "warning",
      body: "Information board for the current heat and the next lineup waiting to take the track.",
    },
    "/race-countdown": {
      title: "Race Countdown",
      subtitle: "How much time is left in this race?",
      staff: false,
      public: true,
      accent: "danger",
      body: "Distance-readable clock driven by the canonical timer and the current lifecycle state.",
    },
    "/race-flags": {
      title: "Race Flags",
      subtitle: "What is the track state right now?",
      staff: false,
      public: true,
      accent: "warning",
      body: "Ultra-minimal state board for fullscreen flag and color communication.",
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

  const FLAG_META = {
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
    SAFE: MODE_META.SAFE,
    HAZARD_SLOW: MODE_META.HAZARD_SLOW,
    HAZARD_STOP: MODE_META.HAZARD_STOP,
    CHECKERED: {
      label: "Checkered",
      tone: "warning",
      detail: "Finish has been called. Post-finish laps are still accepted until lock.",
    },
    LOCKED: {
      label: "Locked",
      tone: "danger",
      detail: "Race is locked. Results are final and lap input is blocked.",
    },
  };

  const SIMULATION_PHASE_META = {
    IDLE: {
      label: "Idle",
      tone: "idle",
      detail: "Simulation is standing by for a staged session.",
    },
    READY: {
      label: "Ready",
      tone: "safe",
      detail: "Simulation can start as soon as the staged session is ready.",
    },
    SAFE_RUN: {
      label: "Safe Run",
      tone: "safe",
      detail: "Simulation is running under green-flag conditions.",
    },
    HAZARD_SLOW: {
      label: "Hazard Slow",
      tone: "warning",
      detail: "A simulated hazard slow is active and the field is pacing down.",
    },
    HAZARD_STOP: {
      label: "Hazard Stop",
      tone: "danger",
      detail: "A simulated hazard stop is active and the field is holding position.",
    },
    RECOVERY: {
      label: "Recovery",
      tone: "safe",
      detail: "The hazard window has cleared and the simulation is back to safe pace.",
    },
    CHECKERED: {
      label: "Checkered",
      tone: "warning",
      detail: "Lap 5 is complete and the finish queue is closing under checkered.",
    },
    PIT_RETURN: {
      label: "Pit Return",
      tone: "warning",
      detail: "Cars are peeling into the pit lane before the session fully locks.",
    },
    COMPLETED: {
      label: "Complete",
      tone: "danger",
      detail: "Simulation finished, pit return is complete, and session progression is ready.",
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
      detail: "Finish has been called. Post-finish laps are still accepted until lock.",
    },
    LOCKED: {
      label: "Locked",
      tone: "danger",
      detail: "Race is locked. Results are final and lap input is blocked.",
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
  const lapTrackVisualState = {
    frameId: 0,
    lastFrameTs: 0,
    markers: new Map(),
    geometry: null,
  };
  const LAP_TRACK_FINISH_PROGRESS = 0.27;
  const LAP_TRACK_VIEWBOX = Object.freeze({
    width: 560,
    height: 320,
  });
  const LAP_TRACK_LAYOUT = Object.freeze({
    loop: Object.freeze([
      Object.freeze({ x: 114, y: 160 }),
      Object.freeze({ x: 132, y: 108 }),
      Object.freeze({ x: 182, y: 76 }),
      Object.freeze({ x: 252, y: 62 }),
      Object.freeze({ x: 340, y: 68 }),
      Object.freeze({ x: 420, y: 92 }),
      Object.freeze({ x: 474, y: 134 }),
      Object.freeze({ x: 490, y: 184 }),
      Object.freeze({ x: 466, y: 230 }),
      Object.freeze({ x: 408, y: 258 }),
      Object.freeze({ x: 324, y: 266 }),
      Object.freeze({ x: 252, y: 252 }),
      Object.freeze({ x: 194, y: 230 }),
      Object.freeze({ x: 148, y: 238 }),
      Object.freeze({ x: 118, y: 208 }),
    ]),
    pitLane: Object.freeze([
      Object.freeze({ x: 382, y: 110 }),
      Object.freeze({ x: 430, y: 126 }),
      Object.freeze({ x: 460, y: 164 }),
      Object.freeze({ x: 454, y: 210 }),
      Object.freeze({ x: 406, y: 228 }),
    ]),
  });
  let state = {
    bootstrap: null,
    bootstrapStatus: "loading",
    bootstrapError: "",
    staffAuthDisabled: false,
    featureFlags: {
      FF_PERSISTENCE: false,
      FF_MANUAL_CAR_ASSIGNMENT: false,
    },
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
    frontDeskSessionId: null,
    carAssignmentEditor: {
      active: false,
      sessionId: null,
      draftValues: {},
    },
    manualAssignmentForm: {
      racerId: null,
      carNumber: "",
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
      flag: "IDLE",
      lapEntryAllowed: false,
      finishOrderActive: false,
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
      lockedSession: null,
      finalResults: null,
      sessions: [],
      leaderboard: [],
    };
  }

  function normalizeFeatureFlags(flags) {
    return {
      FF_PERSISTENCE: Boolean(flags?.FF_PERSISTENCE),
      FF_MANUAL_CAR_ASSIGNMENT: Boolean(flags?.FF_MANUAL_CAR_ASSIGNMENT),
    };
  }

  function setState(patch) {
    state = { ...state, ...patch };
    render();
  }

  function captureGateFocusState() {
    const activeElement = document.activeElement;
    if (!activeElement || activeElement.id !== "staff-key") {
      return null;
    }

    return {
      selectionStart:
        typeof activeElement.selectionStart === "number" ? activeElement.selectionStart : null,
      selectionEnd:
        typeof activeElement.selectionEnd === "number" ? activeElement.selectionEnd : null,
      selectionDirection: activeElement.selectionDirection || "none",
    };
  }

  function restoreGateFocusState(focusState) {
    if (!focusState || !staffGateRequired() || state.gateStatus === "success") {
      return;
    }

    const keyInput = document.getElementById("staff-key");
    if (!keyInput || keyInput.disabled) {
      return;
    }

    if (typeof keyInput.focus === "function") {
      keyInput.focus();
    }

    if (
      typeof keyInput.setSelectionRange === "function" &&
      focusState.selectionStart !== null &&
      focusState.selectionEnd !== null
    ) {
      try {
        keyInput.setSelectionRange(
          focusState.selectionStart,
          focusState.selectionEnd,
          focusState.selectionDirection
        );
      } catch {}
    }
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

  function parseTimestampMs(value) {
    if (Number.isFinite(value)) {
      return value;
    }

    const parsed = Date.parse(value ?? "");
    return Number.isFinite(parsed) ? parsed : null;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
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

  function formatOrdinal(value) {
    if (!Number.isFinite(value) || value <= 0) {
      return "--";
    }

    const mod100 = value % 100;
    if (mod100 >= 11 && mod100 <= 13) {
      return `${value}th`;
    }

    const mod10 = value % 10;
    if (mod10 === 1) {
      return `${value}st`;
    }
    if (mod10 === 2) {
      return `${value}nd`;
    }
    if (mod10 === 3) {
      return `${value}rd`;
    }

    return `${value}th`;
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
      finishPlace: parseNumber(racer.finishPlace),
      finishRecordedAtMs: parseNumber(racer.finishRecordedAtMs),
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
      finishPlace: parseNumber(entry.finishPlace),
    };
  }

  function normalizeSimulation(simulation) {
    if (!isObject(simulation)) {
      return state.raceSnapshot.simulation;
    }

    return {
      status: typeof simulation.status === "string" ? simulation.status : "IDLE",
      active: Boolean(simulation.active),
      phase: typeof simulation.phase === "string" ? simulation.phase : simulation.active ? "SAFE_RUN" : "IDLE",
      sessionId: simulation.sessionId ? String(simulation.sessionId) : null,
      startedAtMs: parseNumber(simulation.startedAtMs),
      endedAtMs: parseNumber(simulation.endedAtMs),
      maxDurationMs: parseNumber(simulation.maxDurationMs),
      targetLapCount: parseNumber(simulation.targetLapCount),
      hardCapReached: Boolean(simulation.hardCapReached),
      completionReason:
        typeof simulation.completionReason === "string" ? simulation.completionReason : null,
      racers: Array.isArray(simulation.racers)
        ? simulation.racers.map((entry) => ({
            racerId: String(entry.racerId),
            carNumber:
              typeof entry.carNumber === "string" && entry.carNumber.trim() !== ""
                ? entry.carNumber
                : null,
            progress: clamp(Number(entry.progress) || 0, 0, 1),
            lane: typeof entry.lane === "string" ? entry.lane : "TRACK",
            pitProgress: clamp(Number(entry.pitProgress) || 0, 0, 1),
            lapIndex: parseNumber(entry.lapIndex) ?? 0,
            targetLapDurationMs: parseNumber(entry.targetLapDurationMs),
            lapProgressMs: Number(entry.lapProgressMs) || 0,
            timedLapStarted: Boolean(entry.timedLapStarted),
            crossingCount: parseNumber(entry.crossingCount) ?? 0,
            targetCompleted: Boolean(entry.targetCompleted),
            finishPlace: parseNumber(entry.finishPlace),
          }))
        : [],
      };
  }

  function getSimulationPhaseMeta(simulation = state.raceSnapshot.simulation) {
    const resolvedPhase = simulation?.phase || (simulation?.active ? "SAFE_RUN" : "IDLE");
    return SIMULATION_PHASE_META[resolvedPhase] || {
      label: resolvedPhase,
      tone: simulation?.active ? "warning" : "idle",
      detail: "",
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
          : sessions.find((session) => session.id !== (currentSessionId || activeSessionId)) || null;
    const queuedSessions = Array.isArray(snapshot.queuedSessions)
      ? snapshot.queuedSessions.map(normalizeSession)
      : sessions.filter((session) => session.id !== (currentSessionId || activeSessionId));
    const queuedSessionIds = Array.isArray(snapshot.queuedSessionIds)
      ? snapshot.queuedSessionIds.map((sessionId) => String(sessionId))
      : queuedSessions.map((session) => session.id);
    const lockedSession =
      isObject(snapshot.lockedSession) && snapshot.lockedSession !== null
        ? normalizeSession(snapshot.lockedSession)
        : null;
    const finalResults = Array.isArray(snapshot.finalResults)
      ? sortLeaderboard(snapshot.finalResults.map(normalizeLeaderboardEntry))
      : null;
    const stateCode = snapshot.state || "IDLE";

    return {
      serverTime: snapshot.serverTime ?? null,
      state: stateCode,
      mode: snapshot.mode || "SAFE",
      flag:
        typeof snapshot.flag === "string" && snapshot.flag.trim() !== ""
          ? snapshot.flag
          : stateCode === "IDLE"
            ? "IDLE"
            : stateCode === "STAGING"
              ? "STAGING"
              : snapshot.mode || "SAFE",
      lapEntryAllowed:
        snapshot.lapEntryAllowed === undefined
          ? state.raceSnapshot.lapEntryAllowed
          : Boolean(snapshot.lapEntryAllowed),
      finishOrderActive:
        snapshot.finishOrderActive === undefined
          ? state.raceSnapshot.finishOrderActive
          : Boolean(snapshot.finishOrderActive),
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
      simulation: normalizeSimulation(snapshot.simulation),
      lockedSession,
      finalResults,
      sessions,
      leaderboard: Array.isArray(snapshot.leaderboard)
        ? sortLeaderboard(snapshot.leaderboard.map(normalizeLeaderboardEntry))
        : [],
    };
  }
  function getActiveSession() {
    return state.raceSnapshot.activeSession;
  }

  function resolveFrontDeskSessionId(snapshot = state.raceSnapshot) {
    const sessions = Array.isArray(snapshot.sessions) ? snapshot.sessions : [];
    if (sessions.length === 0) {
      return null;
    }

    const preferredIds = [
      state.frontDeskSessionId,
      state.sessionForm.id,
      snapshot.nextSessionId,
      snapshot.activeSessionId,
    ];

    for (const sessionId of preferredIds) {
      if (sessionId && sessions.some((session) => session.id === sessionId)) {
        return sessionId;
      }
    }

    return sessions[0].id;
  }

  function getFrontDeskManagedSession(snapshot = state.raceSnapshot) {
    const sessionId = resolveFrontDeskSessionId(snapshot);
    return sessionId
      ? snapshot.sessions.find((session) => session.id === sessionId) || null
      : null;
  }

  function getDisplaySession() {
    return state.raceSnapshot.activeSession || state.raceSnapshot.lockedSession;
  }

  function hasHeldResults(snapshot = state.raceSnapshot) {
    return Boolean(
      snapshot.state !== "RUNNING" &&
        Array.isArray(snapshot.finalResults) &&
        snapshot.finalResults.length > 0
    );
  }

  function getQueuedSessions() {
    if (state.raceSnapshot.queuedSessions.length > 0) {
      return state.raceSnapshot.queuedSessions;
    }

    return state.raceSnapshot.sessions.filter(
      (session) => session.id !== (state.raceSnapshot.currentSessionId || state.raceSnapshot.activeSessionId)
    );
  }

  function getDisplayLeaderboardEntries(snapshot = state.raceSnapshot) {
    if (hasHeldResults(snapshot)) {
      return snapshot.finalResults;
    }

    return snapshot.leaderboard;
  }

  function publicRouteQuestion(pathname = route) {
    if (pathname === "/leader-board") {
      return "Who is leading right now?";
    }

    if (pathname === "/next-race") {
      return "Who is on track now, and who is up next?";
    }

    if (pathname === "/race-countdown") {
      return "How much time is left in this race?";
    }

    if (pathname === "/race-flags") {
      return "What is the track state right now?";
    }

    return "";
  }

  function getFlagMeta(snapshot = state.raceSnapshot) {
    const resolvedFlag = snapshot.flag || snapshot.mode || "SAFE";
    const simulationPhaseMeta = getSimulationPhaseMeta(snapshot.simulation);
    const baseMeta = FLAG_META[resolvedFlag] || {
      label: resolvedFlag,
      tone: STATE_META[snapshot.state]?.tone || "safe",
      detail: STATE_META[snapshot.state]?.detail || "",
    };
    if (
      snapshot.simulation?.active &&
      ["SAFE_RUN", "HAZARD_SLOW", "HAZARD_STOP", "RECOVERY", "CHECKERED", "PIT_RETURN"].includes(
        snapshot.simulation.phase
      )
    ) {
      return {
        ...baseMeta,
        tone: simulationPhaseMeta.tone || baseMeta.tone,
        detail: simulationPhaseMeta.detail || baseMeta.detail,
      };
    }

    if (snapshot.simulation?.status === "COMPLETED" && simulationPhaseMeta.detail) {
      return {
        ...baseMeta,
        detail: simulationPhaseMeta.detail,
      };
    }

    return baseMeta;
  }

  function publicStateMeaning(snapshot = state.raceSnapshot) {
    return getFlagMeta(snapshot).detail || STATE_META[snapshot.state]?.detail || "";
  }

  function hasRaceData() {
    return Boolean(state.lastSyncAt);
  }

  function isInitialPublicLoad() {
    return routeConfig.public && state.bootstrapStatus === "loading" && !hasRaceData();
  }

  function isFinishedState(snapshot = state.raceSnapshot) {
    return snapshot.flag === "CHECKERED";
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
    const nextFrontDeskSessionId = resolveFrontDeskSessionId(normalized);
    const nextSessionForm = normalized.sessions.some(
      (session) => session.id === state.sessionForm.id
    )
      ? state.sessionForm
      : { id: null, name: "" };
    const activeSession = normalized.activeSession;
    const managedSession = nextFrontDeskSessionId
      ? normalized.sessions.find((session) => session.id === nextFrontDeskSessionId) || null
      : null;
    const nextManualAssignmentForm =
      activeSession &&
      activeSession.racers.some((racer) => racer.id === state.manualAssignmentForm.racerId)
        ? state.manualAssignmentForm
        : { racerId: null, carNumber: "" };
    const nextRacerForm =
      managedSession && managedSession.racers.some((racer) => racer.id === state.racerForm.id)
        ? state.racerForm
        : { id: null, name: "", carNumber: "" };
    const keepCarAssignmentEditor =
      Boolean(state.carAssignmentEditor.active) &&
      managedSession &&
      state.carAssignmentEditor.sessionId === managedSession.id &&
      activeSessionEditable(managedSession, normalized);
    const nextCarAssignmentEditor = keepCarAssignmentEditor
      ? {
          active: true,
          sessionId: managedSession.id,
          draftValues: buildCarAssignmentDraft(
            managedSession,
            state.carAssignmentEditor.draftValues
          ),
        }
      : {
          active: false,
          sessionId: null,
          draftValues: {},
        };
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
      frontDeskSessionId: nextFrontDeskSessionId,
      carAssignmentEditor: nextCarAssignmentEditor,
      manualAssignmentForm: nextManualAssignmentForm,
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
        flag: payload.flag || state.raceSnapshot.flag,
        lapEntryAllowed:
          payload.lapEntryAllowed === undefined
            ? state.raceSnapshot.lapEntryAllowed
            : Boolean(payload.lapEntryAllowed),
        finishOrderActive:
          payload.finishOrderActive === undefined
            ? state.raceSnapshot.finishOrderActive
            : Boolean(payload.finishOrderActive),
        activeSessionId:
          payload.activeSessionId === undefined
            ? state.raceSnapshot.activeSessionId
            : payload.activeSessionId === null
              ? null
              : String(payload.activeSessionId),
        simulation:
          payload.simulation === undefined
            ? state.raceSnapshot.simulation
            : normalizeSimulation(payload.simulation),
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
        flag: payload.flag || state.raceSnapshot.flag,
        lapEntryAllowed:
          payload.lapEntryAllowed === undefined
            ? state.raceSnapshot.lapEntryAllowed
            : Boolean(payload.lapEntryAllowed),
        remainingSeconds:
          remainingSeconds === null ? state.raceSnapshot.remainingSeconds : remainingSeconds,
        endsAt: payload.endsAt ?? state.raceSnapshot.endsAt,
        serverTime: payload.serverTime ?? state.raceSnapshot.serverTime,
        simulation:
          payload.simulation === undefined
            ? state.raceSnapshot.simulation
            : normalizeSimulation(payload.simulation),
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
        featureFlags: normalizeFeatureFlags(data.featureFlags),
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

  function manualAssignmentEnabled() {
    return route === "/front-desk" && Boolean(state.featureFlags.FF_MANUAL_CAR_ASSIGNMENT);
  }

  function activeSessionEditable(session = getActiveSession(), snapshot = state.raceSnapshot) {
    return Boolean(
      session &&
        (session.id !== snapshot.activeSessionId ||
          (snapshot.state !== "RUNNING" && snapshot.state !== "FINISHED"))
    );
  }

  function buildCarAssignmentDraft(session, existingDraftValues = {}) {
    if (!session) {
      return {};
    }

    return Object.fromEntries(
      session.racers.map((racer) => [
        racer.id,
        String(existingDraftValues[racer.id] ?? racer.carNumber ?? ""),
      ])
    );
  }

  function getCarAssignmentEditorState() {
    const session = getFrontDeskManagedSession();
    const accessReason = staffAccessReason();
    const editReason = firstReason(
      accessReason,
      state.pending ? "Wait for the current request to finish." : "",
      session ? "" : "Create or choose a saved session before adjusting car numbers.",
      activeSessionEditable(session) ? "" : "Selected session locks once it is RUNNING or FINISHED."
    );
    const startReason = firstReason(
      editReason,
      session?.racers.length ? "" : "Add racers before adjusting car numbers."
    );
    const editorActive =
      Boolean(state.carAssignmentEditor.active) && session && state.carAssignmentEditor.sessionId === session.id;
    const draftValues = session
      ? buildCarAssignmentDraft(
          session,
          editorActive ? state.carAssignmentEditor.draftValues : {}
        )
      : {};
    const rows = session
      ? session.racers.map((racer) => ({
          racer,
          draftCarNumber: String(draftValues[racer.id] ?? ""),
        }))
      : [];
    const counts = rows.reduce((map, row) => {
      if (!row.draftCarNumber) {
        return map;
      }

      map.set(row.draftCarNumber, (map.get(row.draftCarNumber) || 0) + 1);
      return map;
    }, new Map());
    const duplicateCarNumbers = Array.from(counts.entries())
      .filter(([_carNumber, count]) => count > 1)
      .map(([carNumber]) => carNumber)
      .sort((left, right) => parseNumber(left) - parseNumber(right));
    const missingAssignmentRow = rows.find((row) => row.draftCarNumber === "") || null;
    const hasChanges = rows.some(
      (row) => String(row.racer.carNumber ?? "") !== row.draftCarNumber
    );
    const saveReason = firstReason(
      editorActive ? "" : "Select Adjust car numbers first.",
      startReason,
      duplicateCarNumbers.length
        ? `Car ${duplicateCarNumbers[0]} is selected more than once.`
        : "",
      missingAssignmentRow ? `Choose a car for ${missingAssignmentRow.racer.name}.` : "",
      hasChanges ? "" : "Change at least one car number before saving."
    );
    const resetReason = firstReason(
      editorActive ? "" : "Select Adjust car numbers first.",
      startReason
    );

    return {
      session,
      editorActive: Boolean(editorActive),
      draftValues,
      rows,
      hasChanges,
      duplicateCarNumbers,
      editReason,
      startReason,
      saveReason,
      resetReason,
    };
  }

  function getManualAssignmentState() {
    if (!manualAssignmentEnabled()) {
      return null;
    }

    const activeSession = getActiveSession();
    const selectedRacer =
      activeSession?.racers.find((racer) => racer.id === state.manualAssignmentForm.racerId) || null;
    const carNumber = state.manualAssignmentForm.carNumber.trim();
    const duplicateRacer =
      carNumber && activeSession
        ? activeSession.racers.find((racer) => {
            if (selectedRacer && racer.id === selectedRacer.id) {
              return false;
            }

            return (racer.carNumber || "").trim().toLowerCase() === carNumber.toLowerCase();
          }) || null
        : null;
    const accessReason = staffAccessReason();
    const selectionReason = firstReason(
      accessReason,
      state.pending ? "Wait for the current request to finish." : "",
      activeSession ? "" : "Stage a session before assigning cars.",
      activeSessionEditable(activeSession) ? "" : "Assignments lock once the race is RUNNING or FINISHED."
    );
    const saveReason = firstReason(
      selectionReason,
      selectedRacer ? "" : "Choose a racer to assign.",
      carNumber ? "" : "Enter a car number.",
      duplicateRacer
        ? `Car ${carNumber} is already assigned to ${duplicateRacer.name}.`
        : ""
    );
    const clearReason = firstReason(
      selectionReason,
      selectedRacer ? "" : "Choose a racer to clear.",
      selectedRacer?.carNumber ? "" : "Selected racer does not have a car assignment."
    );

    return {
      activeSession,
      selectedRacer,
      carNumber,
      duplicateRacer,
      selectionReason,
      saveReason,
      clearReason,
    };
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

  function compactConnectionTag() {
    const meta = getConnectionMeta();

    return `<span class="telemetry-tag tone-${meta.tone}">${escapeHtml(meta.label)}</span>`;
  }

  function telemetryHeader() {
    const snapshot = state.raceSnapshot;
    const flagMeta = getFlagMeta(snapshot);
    const routeTone = routeConfig.public ? "warning" : routeConfig.staff ? "safe" : "idle";
    const routeLabel = route === "/" ? "Launch Surface" : routeConfig.public ? "Public Display" : "Staff Operation";
    const phaseLabel = route === "/" ? "Control Hub" : STATE_META[snapshot.state]?.label || snapshot.state;
    const compactHomeHeader = route === "/";
    const headerSubtitle = compactHomeHeader ? "" : routeConfig.staff ? routeConfig.body : routeConfig.subtitle;
    const headerCaption = compactHomeHeader || routeConfig.staff ? "" : `<p class="route-caption">${routeConfig.body}</p>`;
    const homeConnectionTag = compactHomeHeader ? compactConnectionTag() : "";
    const headerMeta = compactHomeHeader
      ? ""
      : `
        <div class="telemetry-meta">
          ${connectionStatus()}
          ${routeConfig.public ? fullscreenButton() : ""}
        </div>
      `;

    return `
      <header class="telemetry-header">
        <div class="telemetry-copy">
          <p class="eyebrow">Beachside Racetrack</p>
          <div class="telemetry-title-row">
            <h1>${routeConfig.title}</h1>
            <div class="telemetry-tags">
              <span class="telemetry-tag tone-${routeTone}">${escapeHtml(routeLabel)}</span>
              <span class="telemetry-tag tone-${flagMeta.tone}">${escapeHtml(phaseLabel)}</span>
              ${homeConnectionTag}
              ${debugMode ? '<span class="telemetry-tag tone-warning">Debug View</span>' : ""}
            </div>
          </div>
          ${headerSubtitle ? `<p class="subtitle">${headerSubtitle}</p>` : ""}
          ${headerCaption}
        </div>
        ${headerMeta}
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
      <div class="app-shell route-${route.replace(/\//g, "") || "home"} ${routeConfig.staff ? "staff-shell" : ""} ${routeConfig.public ? "public-shell" : ""} ${document.fullscreenElement ? "is-fullscreen" : ""}">
        <div class="backdrop-grid"></div>
        ${telemetryHeader()}
        <main class="route-grid ${routeConfig.staff ? "staff-route-grid" : ""} ${routeConfig.public ? "public-route-grid" : ""}">
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

  function dataTable(headers, rows, { compact = false, wrapClass = "", tableClass = "" } = {}) {
    return `
      <div class="table-wrap ${wrapClass}">
        <table class="telemetry-table ${compact ? "compact" : ""} ${tableClass}">
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
    const activeSession = getDisplaySession();
    const queuedCount = getQueuedSessions().length;
    const flagMeta = getFlagMeta(snapshot);

    return panel(
      "Race Overview",
      `
        <div class="overview-shell">
          <div class="overview-copy">
            <p class="section-kicker">Live launch hub</p>
            <strong class="overview-title">${escapeHtml(STATE_META[snapshot.state]?.label || snapshot.state)}</strong>
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
      "home-summary-panel"
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

  function controlStatePanelBody() {
    const snapshot = state.raceSnapshot;
    const activeSession = getActiveSession();
    const flagMeta = getFlagMeta(snapshot);
    return `
        <div class="status-marquee tone-${flagMeta.tone}">
          <div class="status-marquee-copy">
            <p class="section-kicker">Live authority</p>
            <strong class="status-marquee-title">${escapeHtml(STATE_META[snapshot.state]?.label || snapshot.state)}</strong>
            <span class="status-marquee-detail">${escapeHtml(flagMeta.detail)}</span>
            <div class="telemetry-tags">
              <span class="telemetry-tag tone-${flagMeta.tone}">${escapeHtml(flagMeta.label)}</span>
              <span class="telemetry-tag tone-${activeSession ? "warning" : "idle"}">${escapeHtml(activeSession ? activeSession.name : "No active session")}</span>
            </div>
          </div>
          <div class="staff-status-metrics">
            ${kpiPill("State", STATE_META[snapshot.state]?.label || snapshot.state, flagMeta.tone)}
            ${kpiPill("Countdown", formatTime(snapshot.remainingSeconds), "danger")}
            ${kpiPill("Racers", String(activeSession ? activeSession.racers.length : 0), activeSession ? "safe" : "danger")}
            ${kpiPill("Socket", state.connection.toUpperCase(), state.connection === "connected" ? "safe" : "danger")}
          </div>
        </div>
        ${staffConnectionAlert()}
        ${noticeMarkup()}
      `;
  }

  function frontDeskControlStateBody() {
    const snapshot = state.raceSnapshot;
    const flagMeta = getFlagMeta(snapshot);
    return `
        <div class="status-marquee tone-${flagMeta.tone}">
          <div class="status-marquee-copy">
            <p class="section-kicker">Live state</p>
            <strong class="status-marquee-title">${escapeHtml(STATE_META[snapshot.state]?.label || snapshot.state)}</strong>
            <span class="status-marquee-detail">${escapeHtml(flagMeta.detail)}</span>
          </div>
          <div class="staff-status-metrics">
            ${kpiPill("Flag", flagMeta.label, flagMeta.tone)}
            ${kpiPill("Countdown", formatTime(snapshot.remainingSeconds), "danger")}
          </div>
        </div>
      `;
  }

  function raceControlConsoleStatusBody() {
    const activeSession = getActiveSession();
    const simulationPhaseMeta = getSimulationPhaseMeta(getSimulationMeta());
    return `
        <div class="race-control-telemetry-strip">
          ${kpiPill("Countdown", formatTime(state.raceSnapshot.remainingSeconds), "danger")}
          ${kpiPill("Racers", String(activeSession ? activeSession.racers.length : 0), activeSession ? "safe" : "danger")}
          ${kpiPill("Scenario", simulationPhaseMeta.label, simulationPhaseMeta.tone)}
        </div>
      `;
  }

  function staffStatusPanel() {
    return panel(
      "Control State",
      controlStatePanelBody(),
      "safe",
      "staff-status-panel"
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
  const featureBundlePaths = [
    "/feature-frontdesk.js",
    "/feature-race-control.js",
    "/feature-lap-line-tracker.js",
    "/feature-public.js",
    "/feature-home.js",
  ];
  let featureBundleSources = null;

  async function fetchFeatureBundles() {
    if (featureBundleSources) {
      return featureBundleSources;
    }

    featureBundleSources = await Promise.all(
      featureBundlePaths.map(async (bundlePath) => {
        const response = await fetch(bundlePath, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Could not load client bundle ${bundlePath}.`);
        }

        return {
          bundlePath,
          bundleSource: await response.text(),
        };
      })
    );

    return featureBundleSources;
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
      return [frontDeskHotfixPanel(), debugMode ? runtimePanel() : ""].join("");
    }

    if (route === "/race-control") {
      return [raceControlPanel(), debugMode ? runtimePanel() : ""].join("");
    }

    if (route === "/lap-line-tracker") {
      return [staffStatusPanel(), lapTrackerPanel(), debugMode ? runtimePanel() : ""].join("");
    }

    if (route === "/leader-board") {
      return leaderBoardPanels();
    }

    if (route === "/next-race") {
      return nextRacePanels();
    }

    if (route === "/race-countdown") {
      return countdownPanels();
    }

    if (route === "/race-flags") {
      return flagPanels();
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
  function render() {
    const gateFocusState = captureGateFocusState();
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
      ensureLapTrackAnimation();
    } else {
      stopLapTrackAnimation();
    }

    if (routeConfig.public && !publicConnectStarted) {
      publicConnectStarted = true;
      connectSocket(undefined);
    }

    if (routeConfig.staff && state.staffAuthDisabled && !staffBypassConnectStarted) {
      staffBypassConnectStarted = true;
      connectSocket(undefined);
    }

    restoreGateFocusState(gateFocusState);
  }

  document.addEventListener("fullscreenchange", render);
  document.addEventListener("fullscreenerror", () => {
    setState({
      fullscreenError: "Fullscreen failed to change state.",
    });
  });

  try {
    const featureBundles = await fetchFeatureBundles();
    for (const { bundlePath, bundleSource } of featureBundles) {
      eval(`${bundleSource}\n//# sourceURL=${bundlePath}`);
    }
    loadBootstrap();
    render();
  } catch (error) {
    console.error(error);
    appEl.innerHTML = appShell(
      panel(
        "Client Load Error",
        inlineAlert({
          tone: "danger",
          title: "The route shell could not finish loading.",
          detail: error?.message || "One of the client feature bundles failed to load.",
        }),
        "danger",
        "panel-wide"
      )
    );
  }

  window.RacetrackUI = {
    fullscreenButton,
    panel,
    telemetryHeader,
  };
})();
