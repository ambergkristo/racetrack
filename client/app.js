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
      body: "Set up the next race, manage the active roster, and keep start-line operations clear.",
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
  };
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
    const finishOrderActive = entries.some((entry) => Number.isFinite(entry.finishPlace));
    return entries
      .slice()
      .sort((left, right) => {
        if (finishOrderActive) {
          const leftFinished = Number.isFinite(left.finishPlace);
          const rightFinished = Number.isFinite(right.finishPlace);

          if (leftFinished && rightFinished && left.finishPlace !== right.finishPlace) {
            return left.finishPlace - right.finishPlace;
          }

          if (leftFinished !== rightFinished) {
            return leftFinished ? -1 : 1;
          }
        }

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
        position: Number.isFinite(entry.finishPlace) ? entry.finishPlace : index + 1,
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
            progress: clamp(Number(entry.progress) || 0, 0, 1),
            lapIndex: parseNumber(entry.lapIndex) ?? 1,
            targetLapDurationMs: parseNumber(entry.targetLapDurationMs),
            lapProgressMs: Number(entry.lapProgressMs) || 0,
            targetCompleted: Boolean(entry.targetCompleted),
            finishPlace: parseNumber(entry.finishPlace),
          }))
        : [],
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
    return FLAG_META[resolvedFlag] || {
      label: resolvedFlag,
      tone: STATE_META[snapshot.state]?.tone || "safe",
      detail: STATE_META[snapshot.state]?.detail || "",
    };
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

  function activeSessionEditable(session = getActiveSession()) {
    return Boolean(
      session &&
        (session.id !== state.raceSnapshot.activeSessionId ||
          (state.raceSnapshot.state !== "RUNNING" && state.raceSnapshot.state !== "FINISHED"))
    );
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
    const syncLabel = state.awaitingLiveResync ? "waiting" : "live";
    const gateLabel = state.staffAuthDisabled ? "Bypassed" : state.gateStatus;
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
        <div class="staff-chip-row">
          <span class="chip">Gate ${escapeHtml(gateLabel)}</span>
          <span class="chip">Manual Assign: ${escapeHtml(state.featureFlags.FF_MANUAL_CAR_ASSIGNMENT ? "ON" : "OFF")}</span>
          <span class="chip">Sync ${escapeHtml(syncLabel)}</span>
          <span class="chip">Last sync ${escapeHtml(formatTimestamp(state.lastSyncAt))}</span>
        </div>
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
    return `
        <div class="race-control-telemetry-strip">
          ${kpiPill("Countdown", formatTime(state.raceSnapshot.remainingSeconds), "danger")}
          ${kpiPill("Racers", String(activeSession ? activeSession.racers.length : 0), activeSession ? "safe" : "danger")}
          ${kpiPill("Socket", state.connection.toUpperCase(), state.connection === "connected" ? "safe" : "danger")}
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
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function sessionActionState(session) {
    const isCurrent = session.id === state.raceSnapshot.currentSessionId;
    const raceLive =
      state.raceSnapshot.state === "RUNNING" || state.raceSnapshot.state === "FINISHED";
    const accessReason = staffAccessReason();

    return {
      isCurrent,
      selectReason: firstReason(
        accessReason,
        state.pending ? "Wait for the current request to finish." : "",
        isCurrent ? "This session is already current." : "",
        raceLive ? "Current session changes lock while the race is RUNNING or FINISHED." : ""
      ),
      editReason: firstReason(
        accessReason,
        state.pending ? "Wait for the current request to finish." : "",
        isCurrent && raceLive
          ? "Current session edits lock once the race is RUNNING or FINISHED."
          : ""
      ),
      deleteReason: firstReason(
        accessReason,
        state.pending ? "Wait for the current request to finish." : "",
        isCurrent && raceLive
          ? "Current session deletes lock once the race is RUNNING or FINISHED."
          : ""
      ),
    };
  }

  function queueSessionCard(session, kind = "queued") {
    const actionState = sessionActionState(session);
    const statusLabel =
      kind === "current"
        ? STATE_META[state.raceSnapshot.state]?.label || state.raceSnapshot.state
        : kind === "next"
          ? "Queued next"
          : "Queued";
    const visibleRacers = session.racers.slice(0, kind === "queued" ? 3 : 4);
    const rosterMarkup =
      session.racers.length > 0
        ? `
            <div class="queue-roster">
              ${visibleRacers
                .map(
                  (racer) => `
                    <div class="queue-racer-row">
                      <span>${escapeHtml(racer.name)}</span>
                      <strong>${escapeHtml(racer.carNumber || "--")}</strong>
                    </div>
                  `
                )
                .join("")}
            </div>
            ${
              session.racers.length > visibleRacers.length
                ? `<p class="queue-overflow-note">+${session.racers.length - visibleRacers.length} more racers staged</p>`
                : ""
            }
          `
        : '<p class="hint">No racers staged yet.</p>';

    return `
      <article class="queue-card queue-card-${kind}">
        <div class="queue-card-head">
          <div>
            <p class="queue-kicker">${escapeHtml(
              kind === "current" ? "Current" : kind === "next" ? "Next Up" : "Queued later"
            )}</p>
            <strong class="queue-title">${escapeHtml(session.name)}</strong>
          </div>
          <span class="chip tiny-chip">${escapeHtml(statusLabel)}</span>
        </div>
        <div class="stack-list compact-list queue-meta">
          <div class="info-row"><span>Racers</span><strong>${session.racers.length}</strong></div>
          <div class="info-row"><span>Session status</span><strong>${escapeHtml(statusLabel)}</strong></div>
        </div>
        ${rosterMarkup}
        <div class="controls queue-actions">
          ${buttonMarkup({
            label: kind === "current" ? "Current" : "Make Current",
            variant: actionState.isCurrent ? "warning" : "ghost",
            size: "mini",
            disabled: Boolean(actionState.selectReason),
            attrs: `data-action="stage-session" data-session-id="${escapeHtml(session.id)}"`,
          })}
          ${buttonMarkup({
            label: "Edit",
            variant: "ghost",
            size: "mini",
            disabled: Boolean(actionState.editReason),
            attrs: `data-action="edit-session" data-session-id="${escapeHtml(session.id)}"`,
          })}
          ${buttonMarkup({
            label: "Delete",
            variant: "danger",
            size: "mini",
            disabled: Boolean(actionState.deleteReason),
            attrs: `data-action="delete-session" data-session-id="${escapeHtml(session.id)}"`,
          })}
        </div>
      </article>
    `;
  }

  function frontDeskSummaryCard({
    kicker,
    title,
    detail,
    tone = "safe",
    metaLabel = "",
    extraClass = "",
    content = "",
    metrics = [],
  }) {
    return `
      <article class="frontdesk-summary-card tone-${escapeHtml(tone)} ${extraClass}">
        <div class="frontdesk-summary-head">
          <div>
            <p class="queue-kicker">${escapeHtml(kicker)}</p>
            <strong class="queue-title">${escapeHtml(title)}</strong>
          </div>
          ${metaLabel ? `<span class="chip tiny-chip">${escapeHtml(metaLabel)}</span>` : ""}
        </div>
        <p class="frontdesk-summary-detail">${escapeHtml(detail)}</p>
        ${content}
        <div class="frontdesk-summary-metrics">
          ${metrics
            .map(
              (metric) => `
                <div class="frontdesk-summary-metric">
                  <span>${escapeHtml(metric.label)}</span>
                  <strong>${escapeHtml(metric.value)}</strong>
                </div>
              `
            )
            .join("")}
        </div>
      </article>
    `;
  }

  function frontDeskRosterPreview(session, limit = 3) {
    if (!session || session.racers.length === 0) {
      return '<p class="compact-empty-note">No racers staged yet.</p>';
    }

    const visibleRacers = session.racers.slice(0, limit);
    return `
      <div class="queue-roster frontdesk-roster-preview">
        ${visibleRacers
          .map(
            (racer) => `
              <div class="queue-racer-row">
                <span>${escapeHtml(racer.name)}</span>
                <strong>${escapeHtml(racer.carNumber || "--")}</strong>
              </div>
            `
          )
          .join("")}
      </div>
      ${
        session.racers.length > visibleRacers.length
          ? `<p class="queue-overflow-note">+${session.racers.length - visibleRacers.length} more racers staged</p>`
          : ""
      }
    `;
  }

  function queuedSessionCompactList(sessions) {
    if (sessions.length === 0) {
      return '<p class="compact-empty-note">Create a session to prepare the next race.</p>';
    }

    const selectedSessionId = resolveFrontDeskSessionId();

    return `
      <div class="queued-session-list">
        ${sessions
          .map((session) => {
            const actionState = sessionActionState(session);
            return `
              <article class="queued-session-row${session.id === selectedSessionId ? " is-selected" : ""}">
                <div class="queued-session-copy">
                  <strong>${escapeHtml(session.name)}</strong>
                  <span>${escapeHtml(`${session.racers.length} racers registered`)}</span>
                </div>
                <div class="controls queued-session-actions">
                  ${buttonMarkup({
                    label: "Make Current",
                    variant: "ghost",
                    size: "mini",
                    disabled: Boolean(actionState.selectReason),
                    attrs: `data-action="stage-session" data-session-id="${escapeHtml(session.id)}"`,
                  })}
                  ${buttonMarkup({
                    label: "Edit",
                    variant: "ghost",
                    size: "mini",
                    disabled: Boolean(actionState.editReason),
                    attrs: `data-action="edit-session" data-session-id="${escapeHtml(session.id)}"`,
                  })}
                  ${buttonMarkup({
                    label: "Delete",
                    variant: "danger",
                    size: "mini",
                    disabled: Boolean(actionState.deleteReason),
                    attrs: `data-action="delete-session" data-session-id="${escapeHtml(session.id)}"`,
                  })}
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function queuedSessionList() {
    const queuedSessions = getQueuedSessions().filter(
      (session) => session.id !== state.raceSnapshot.nextSessionId
    );

    if (queuedSessions.length === 0) {
      return emptyState(
        "No later queued sessions",
        "Create another session to keep the queue visible beyond the next slot."
      );
    }

    return `
      <div class="queue-lane">
        ${queuedSessions.map((session) => queueSessionCard(session, "queued")).join("")}
      </div>
    `;
  }

  function racerRows(activeSession) {
    if (!activeSession) {
      return '<tr><td colspan="4" class="hint">Create or choose a saved session to manage racers.</td></tr>';
    }

    if (activeSession.racers.length === 0) {
      return '<tr><td colspan="4" class="hint">No racers in the selected session.</td></tr>';
    }

    const editBlocked = !activeSessionEditable(activeSession);
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
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function getFrontDeskFormState() {
    const activeSession = getFrontDeskManagedSession();
    const updateMode = state.sessionForm.id !== null;
    const racerUpdateMode = state.racerForm.id !== null;
    const accessReason = staffAccessReason();
    const activeEditable = activeSessionEditable(activeSession);
    const autoAssignmentMode = !manualAssignmentEnabled();
    const normalizedCarNumber = autoAssignmentMode ? "" : state.racerForm.carNumber.trim().toLowerCase();
    const duplicateCarRacer =
      normalizedCarNumber && activeSession
        ? activeSession.racers.find((racer) => {
            if (state.racerForm.id && racer.id === state.racerForm.id) {
              return false;
            }

            return (racer.carNumber || "").trim().toLowerCase() === normalizedCarNumber;
          }) || null
        : null;
    const saveSessionReason = firstReason(
      accessReason,
      state.pending ? "Wait for the current request to finish." : "",
      state.sessionForm.name.trim() ? "" : "Enter a session name."
    );
    const racerEditReason = firstReason(
      accessReason,
      state.pending ? "Wait for the current request to finish." : "",
      activeSession ? "" : "Create or choose a saved session before adding racers.",
      activeEditable ? "" : "Selected session locks once it is RUNNING or FINISHED."
    );
    const saveRacerReason = firstReason(
      racerEditReason,
      state.racerForm.name.trim() ? "" : "Enter a racer name.",
      duplicateCarRacer
        ? `Car ${state.racerForm.carNumber.trim()} is already assigned to ${duplicateCarRacer.name}.`
        : ""
    );
    const frontDeskReasons = actionGuardList([
      { label: updateMode ? "Save Session" : "Create Session", reason: saveSessionReason },
      { label: racerUpdateMode ? "Save Racer" : "Add Racer", reason: saveRacerReason },
    ]);

    return {
      activeSession,
      updateMode,
      racerUpdateMode,
      duplicateCarRacer,
      saveSessionReason,
      racerEditReason,
      saveRacerReason,
      frontDeskReasons,
      autoAssignmentMode,
    };
  }

  function frontDeskPanel() {
    const formState = getFrontDeskFormState();
    const currentSession = state.raceSnapshot.currentSession || formState.activeSession;
    const nextSession = state.raceSnapshot.nextSession;
    const queuedSessions = getQueuedSessions();
    const queuedLater = queuedSessions.filter((session) => session.id !== state.raceSnapshot.nextSessionId);
    const queueCount = queuedSessions.length;
    const currentSummary = currentSession
      ? frontDeskSummaryCard({
          kicker: "Current",
          title: currentSession.name,
          detail: "Active operator focus for roster and handoff control.",
          tone: "safe",
          metaLabel: STATE_META[state.raceSnapshot.state]?.label || state.raceSnapshot.state,
          content: frontDeskRosterPreview(currentSession),
          metrics: [
            { label: "Racers", value: String(currentSession.racers.length) },
            { label: "State", value: STATE_META[state.raceSnapshot.state]?.label || state.raceSnapshot.state },
          ],
        })
      : frontDeskSummaryCard({
          kicker: "Current",
          title: "No current session",
          detail: "Create a session first. The current slot becomes the operator anchor immediately after staging.",
          tone: "warning",
          metaLabel: "Waiting",
          metrics: [
            { label: "Current", value: "None" },
            { label: "Next", value: nextSession ? nextSession.name : "None" },
          ],
        });
    const nextSummary = nextSession
      ? frontDeskSummaryCard({
          kicker: "Next Up",
          title: nextSession.name,
          detail: "Keep the next handoff visible so the right lineup is ready without hunting through the queue.",
          tone: "warning",
          metaLabel: "Queued next",
          content: frontDeskRosterPreview(nextSession),
          metrics: [
            { label: "Racers", value: String(nextSession.racers.length) },
            { label: "Queue", value: `${queueCount}` },
          ],
        })
      : frontDeskSummaryCard({
          kicker: "Next Up",
          title: "No next session",
          detail: "Create a second session to make the next handoff visible before the active heat changes.",
          tone: "warning",
          metaLabel: "Open slot",
          metrics: [
            { label: "Queued", value: `${queueCount}` },
            { label: "Action", value: "Create" },
          ],
        });
    const queueSummary = frontDeskSummaryCard({
      kicker: "Queued later",
      title: queuedLater.length ? `${queuedLater.length} later session${queuedLater.length === 1 ? "" : "s"}` : "No later queue",
      detail: queuedLater.length
        ? queuedLater.slice(0, 2).map((session) => session.name).join(" • ")
        : "No later queued sessions yet. Add another heat only when the desk needs a visible backlog.",
      tone: queuedLater.length ? "warning" : "safe",
      metaLabel: `${queueCount} queued`,
      metrics: [
        { label: "Current", value: currentSession ? currentSession.name : "None" },
        { label: "Next", value: nextSession ? nextSession.name : "None" },
      ],
    });

    return [
      panel(
        "Front Desk Workflow",
        `
          <div class="frontdesk-workflow ${manualAssignmentEnabled() ? "has-secondary" : "is-single-column"}">
            <div class="frontdesk-console">
              <p class="frontdesk-workflow-label">Current / next / queued at a glance</p>
              <div class="frontdesk-summary-strip">
                ${currentSummary}
                ${nextSummary}
                ${queueSummary}
              </div>
              <div class="frontdesk-ops-grid">
                <div class="frontdesk-block frontdesk-flow-card">
                  <div class="frontdesk-block-head">
                    <div>
                      <p class="section-kicker">Queue control</p>
                      <strong class="queue-title">${formState.updateMode ? "Edit session" : "Create and queue sessions"}</strong>
                    </div>
                    <span class="chip tiny-chip">${queueCount} queued</span>
                  </div>
                  <div class="frontdesk-form-grid">
                    <div class="form-stack">
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
                    <div class="summary-stack frontdesk-truth-card">
                      <p class="section-kicker">Workflow truth</p>
                      <strong class="frontdesk-truth-value">${escapeHtml(currentSession ? currentSession.name : "No current session")}</strong>
      <div class="stack-list compact-list">
        <div class="info-row"><span>Current</span><strong>${escapeHtml(currentSession ? currentSession.name : "None")}</strong></div>
        <div class="info-row"><span>Next</span><strong>${escapeHtml(nextSession ? nextSession.name : "None")}</strong></div>
        <div class="info-row"><span>Queue size</span><strong>${queueCount}</strong></div>
      </div>
                    </div>
                  </div>
                  <div class="frontdesk-inline-card">
                    <div class="frontdesk-inline-head">
                      <p class="queue-kicker">Queued later</p>
                      <span class="chip tiny-chip">${queuedLater.length}</span>
                    </div>
                    ${queuedSessionCompactList(queuedLater)}
                  </div>
                  <div id="front-desk-guards" class="frontdesk-guard-strip">
                    ${formState.frontDeskReasons}
                  </div>
                </div>
                <div class="frontdesk-block frontdesk-racer-card">
                  <div class="frontdesk-block-head">
                    <div>
                      <p class="section-kicker">Racer management</p>
                      <strong class="queue-title">${formState.racerUpdateMode ? "Edit racer" : "Add racer to current"}</strong>
                    </div>
                  </div>
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
                  <p id="racer-edit-hint" class="hint">${escapeHtml(formState.racerEditReason || "Racer list, assigned car, and current session status stay visible together.")}</p>
                  ${dataTable(["Racer", "Car", "Laps", "Actions"], [racerRows(formState.activeSession)], { compact: true })}
                </div>
              </div>
            </div>
            ${
              manualAssignmentEnabled()
                ? `
                  <div class="front-desk-secondary">
                    <section class="frontdesk-block manual-assignment-banner">
                      <div class="frontdesk-block-head">
                        <div>
                          <p class="section-kicker">Upgrade flag active</p>
                          <strong class="queue-title">Manual assignment active</strong>
                        </div>
                        <span class="chip tiny-chip">FF ON</span>
                      </div>
                      <p class="hint">Manual assignment stays separate from queue ordering truth.</p>
                    </section>
                    ${manualAssignmentPanel(true)}
                  </div>
                `
                : ""
            }
          </div>
        `,
        "warning",
        "staff-main-panel frontdesk-panel"
      ),
    ].join("");
  }

  function frontDeskHotfixPanel() {
    const formState = getFrontDeskFormState();
    const currentSession = state.raceSnapshot.currentSession || state.raceSnapshot.activeSession;
    const managedSession = formState.activeSession || state.raceSnapshot.nextSession || currentSession;
    const upcomingSessions = getQueuedSessions();
    const sessionCount = upcomingSessions.length;
    const registeredCount = managedSession ? managedSession.racers.length : 0;
    const currentSessionLabel = managedSession ? managedSession.name : "No session ready";
    const setupFlowLabel = !managedSession
      ? "Create session"
      : registeredCount === 0
        ? "Add racers"
        : registeredCount >= 8
          ? "Roster ready"
          : "Keep staging";
    const setupFlowDetail = !managedSession
      ? "Create the next race first. The right panel stays reserved for racer standby."
      : registeredCount === 0
        ? "Session is saved. Add racers on the right when you are ready."
        : registeredCount >= 8
          ? "Standby roster is full. Review the session list below if you need a different next race."
          : `${registeredCount} racer${registeredCount === 1 ? "" : "s"} staged. Keep building the standby roster on the right.`;
    const racerManagementBody = `
      <div class="frontdesk-card-copy">
        <strong class="frontdesk-target-session">${escapeHtml(managedSession ? managedSession.name : "Choose a session to manage")}</strong>
        <p id="racer-edit-hint" class="hint">${escapeHtml(
          formState.racerEditReason ||
            (formState.autoAssignmentMode
              ? "Cars auto-assign from the authoritative 1-8 pool when racers are added."
              : "Racer edits and car numbers save against the selected session.")
        )}</p>
      </div>
      <div class="ops-board racer-board frontdesk-racer-form">
        <label class="field">
          <span>Racer name</span>
          <input id="racer-name-input" type="text" value="${escapeHtml(state.racerForm.name)}" placeholder="Driver Name" ${formState.racerEditReason ? "disabled" : ""} />
        </label>
        ${
          formState.autoAssignmentMode
            ? `
              <div class="auto-assignment-note">
                <span class="chip tiny-chip">Cars 1-8</span>
                <strong>Assigned automatically</strong>
                <span>Duplicate car numbers are blocked by the canonical session truth.</span>
              </div>
            `
            : `
              <label class="field">
                <span>Car number</span>
                <input id="car-number-input" type="text" value="${escapeHtml(state.racerForm.carNumber)}" placeholder="7" ${formState.racerEditReason ? "disabled" : ""} />
              </label>
            `
        }
        <div class="controls">
          ${buttonMarkup({
            id: "save-racer-btn",
            label: formState.racerUpdateMode ? "Save Racer" : "Add Racer",
            disabled: Boolean(formState.saveRacerReason),
          })}
          ${formState.racerUpdateMode ? buttonMarkup({ id: "cancel-racer-edit-btn", label: "Cancel", variant: "ghost" }) : ""}
        </div>
      </div>
      <div class="frontdesk-racer-table">
        ${dataTable(["Racer", "Car", "Laps", "Actions"], [racerRows(managedSession)], { compact: true })}
      </div>
    `;
    const setupBody = `
      <section class="frontdesk-inline-section frontdesk-create-section">
        <div class="frontdesk-card-copy">
          <strong class="queue-title">${formState.updateMode ? "Edit Session" : "Create Session"}</strong>
          <p class="hint">Name the next race here, then use the right panel to build the standby roster.</p>
        </div>
        <div class="frontdesk-queue-setup frontdesk-create-form">
          <div class="form-stack">
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
        </div>
      </section>
      <section class="frontdesk-inline-section frontdesk-fact-section frontdesk-summary-section">
        <div class="frontdesk-inline-head">
          <p class="queue-kicker">Session Summary</p>
          <span class="chip tiny-chip">${escapeHtml(setupFlowLabel)}</span>
        </div>
        <div class="summary-stack frontdesk-truth-card">
          <strong class="frontdesk-truth-value">${escapeHtml(currentSessionLabel)}</strong>
          <p class="compact-empty-note">${escapeHtml(setupFlowDetail)}</p>
          <div class="stack-list compact-list frontdesk-summary-list">
            <div class="info-row frontdesk-summary-row"><span>Current Race</span><strong>${escapeHtml(currentSession ? currentSession.name : "None")}</strong></div>
            <div class="info-row frontdesk-summary-row"><span>Registered Racers</span><strong>${registeredCount}</strong></div>
            <div class="info-row frontdesk-summary-row"><span>Saved Sessions</span><strong>${sessionCount}</strong></div>
          </div>
        </div>
      </section>
      <section class="frontdesk-inline-section frontdesk-schedule-section">
        <div class="frontdesk-inline-head">
          <p class="queue-kicker">Saved Sessions</p>
          <span class="chip tiny-chip">${sessionCount}</span>
        </div>
        <p class="frontdesk-section-note">Pick which saved session should stay ready for the standby racer area on the right.</p>
        <div class="frontdesk-scroll-area">
          ${queuedSessionCompactList(upcomingSessions)}
        </div>
      </section>
      <section class="frontdesk-inline-section frontdesk-control-section">
        <div class="frontdesk-inline-head">
          <p class="queue-kicker">Control State</p>
          <span class="chip tiny-chip">${escapeHtml(STATE_META[state.raceSnapshot.state]?.label || state.raceSnapshot.state)}</span>
        </div>
        <p class="frontdesk-section-note">Read-only race state for the front-desk operator while the setup flow stays active.</p>
        <div class="frontdesk-control-body">
          ${frontDeskControlStateBody()}
        </div>
      </section>
      <div id="front-desk-guards" class="frontdesk-guard-strip">
        ${formState.frontDeskReasons}
      </div>
      ${
        manualAssignmentEnabled()
          ? manualAssignmentPanel(true)
          : ""
      }
    `;

    return panel(
      "Front Desk Console",
      `
        <div class="frontdesk-workflow is-single-column">
          <div class="frontdesk-shell-grid">
            <section class="frontdesk-desktop-card frontdesk-setup-card">
              <div class="frontdesk-desktop-head">
                <div>
                  <p class="section-kicker">Setup panel</p>
                  <strong class="queue-title">Next Race Setup</strong>
                </div>
              </div>
              <div class="frontdesk-desktop-body frontdesk-setup-body">
                ${setupBody}
              </div>
            </section>
            <section class="frontdesk-desktop-card frontdesk-racer-card">
              <div class="frontdesk-desktop-head">
                <div>
                  <p class="section-kicker">Primary panel</p>
                  <strong class="queue-title">Racer Management</strong>
                </div>
                <span class="chip tiny-chip">${managedSession ? managedSession.name : "No session"}</span>
              </div>
              <div class="frontdesk-desktop-body frontdesk-racer-body">
                ${racerManagementBody}
              </div>
            </section>
          </div>
        </div>
      `,
      "warning",
      "staff-main-panel frontdesk-panel frontdesk-shell-panel"
    );
  }

  function manualAssignmentRoster(activeSession, selectedRacer) {
    if (!activeSession) {
      return emptyState(
        "No staged session",
        "Stage a session first. The assignment roster will unlock on the active heat."
      );
    }

    if (activeSession.racers.length === 0) {
      return emptyState(
        "No racers ready for assignment",
        "Add racers to the active session, then assign their cars from this panel."
      );
    }

    return `
      <div class="assignment-grid">
        ${activeSession.racers
          .map((racer) => {
            const selected = selectedRacer?.id === racer.id;

            return `
              <button
                class="assignment-card ${selected ? "is-selected" : ""}"
                type="button"
                data-action="select-manual-racer"
                data-racer-id="${escapeHtml(racer.id)}"
              >
                <span class="assignment-card-label">${escapeHtml(selected ? "Selected racer" : "Tap to assign")}</span>
                <strong>${escapeHtml(racer.name)}</strong>
                <div class="assignment-card-meta">
                  <span>Current car</span>
                  <em>${escapeHtml(racer.carNumber || "--")}</em>
                </div>
              </button>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function manualAssignmentPanel(embed = false) {
    if (!embed && !manualAssignmentEnabled()) {
      return "";
    }

    const assignmentState = getManualAssignmentState();
    const selectedLabel = assignmentState.selectedRacer
      ? `${assignmentState.selectedRacer.name} ${assignmentState.selectedRacer.carNumber ? `· Car ${assignmentState.selectedRacer.carNumber}` : "· Unassigned"}`
      : "Choose a racer from the roster";
    const guidance = assignmentState.selectionReason
      ? inlineAlert({
          tone: "warning",
          title: "Assignment guard active",
          detail: assignmentState.selectionReason,
        })
      : "";
    const validation = assignmentState.saveReason && !assignmentState.selectionReason
      ? inlineAlert({
          tone: assignmentState.duplicateRacer ? "danger" : "warning",
          title: assignmentState.duplicateRacer ? "Assignment conflict" : "Assignment incomplete",
          detail: assignmentState.saveReason,
        })
      : "";
    const guardList = actionGuardList([
      { label: "Assign car", reason: assignmentState.saveReason },
      { label: "Clear assignment", reason: assignmentState.clearReason },
    ]);

    const content = `
        <div class="assignment-shell">
          <div class="assignment-console">
            <p class="section-kicker">Upgrade flag active</p>
            <strong class="summary-value">Manual assignment console</strong>
            <div class="telemetry-tags">
              <span class="telemetry-tag tone-warning">Flag ON</span>
              <span class="telemetry-tag tone-safe">${escapeHtml(selectedLabel)}</span>
            </div>
            <p class="hint">Guarded by <code>FF_MANUAL_CAR_ASSIGNMENT</code>.</p>
            <label class="field">
              <span>Car number</span>
              <input id="manual-car-number-input" type="text" value="${escapeHtml(state.manualAssignmentForm.carNumber)}" placeholder="12" ${assignmentState.selectionReason ? "disabled" : ""} />
            </label>
            <div class="controls">
              ${buttonMarkup({
                id: "assign-car-btn",
                label: "Assign Car",
                variant: "warning",
                disabled: Boolean(assignmentState.saveReason),
              })}
              ${buttonMarkup({
                id: "clear-car-btn",
                label: "Clear Assignment",
                variant: "ghost",
                disabled: Boolean(assignmentState.clearReason),
              })}
            </div>
            <div id="manual-assignment-feedback">
              ${guidance}
              ${validation}
            </div>
            <div id="manual-assignment-guards">
              ${guardList}
            </div>
          </div>
          <div class="assignment-roster-shell">
            <p class="section-kicker">Active roster</p>
            ${manualAssignmentRoster(
              assignmentState.activeSession,
              assignmentState.selectedRacer
            )}
          </div>
        </div>
      `;

    if (embed) {
      return `
        <section class="front-desk-embedded-panel">
          <div class="panel-heading">
            <h2>Manual Car Assignment</h2>
          </div>
          ${content}
        </section>
      `;
    }

    return panel("Manual Car Assignment", content, "warning", "panel-wide");
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
        formState.racerEditReason || "Racer edits apply to the selected saved session.";
    }

    if (manualAssignmentEnabled()) {
      const assignmentState = getManualAssignmentState();
      const assignBtn = document.getElementById("assign-car-btn");
      const clearBtn = document.getElementById("clear-car-btn");
      const manualInput = document.getElementById("manual-car-number-input");
      const feedback = document.getElementById("manual-assignment-feedback");
      const assignmentGuards = document.getElementById("manual-assignment-guards");

      if (assignBtn) {
        assignBtn.disabled = Boolean(assignmentState.saveReason);
      }

      if (clearBtn) {
        clearBtn.disabled = Boolean(assignmentState.clearReason);
      }

      if (manualInput) {
        manualInput.disabled = Boolean(assignmentState.selectionReason);
      }

      if (feedback) {
        const guidance = assignmentState.selectionReason
          ? inlineAlert({
              tone: "warning",
              title: "Assignment guard active",
              detail: assignmentState.selectionReason,
            })
          : "";
        const validation = assignmentState.saveReason && !assignmentState.selectionReason
          ? inlineAlert({
              tone: assignmentState.duplicateRacer ? "danger" : "warning",
              title: assignmentState.duplicateRacer
                ? "Assignment conflict"
                : "Assignment incomplete",
              detail: assignmentState.saveReason,
            })
          : "";
        feedback.innerHTML = guidance + validation;
      }

      if (assignmentGuards) {
        assignmentGuards.innerHTML = actionGuardList([
          { label: "Assign car", reason: assignmentState.saveReason },
          { label: "Clear assignment", reason: assignmentState.clearReason },
        ]);
      }
    }
  }

  function leaderboardTable(
    entries,
    {
      limit = entries.length,
      wrapClass = "",
      tableClass = "",
      finishOrderActive = state.raceSnapshot.finishOrderActive,
    } = {}
  ) {
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
    const visibleEntries = entries.slice(0, limit);
    const columns = finishOrderActive
      ? ["Place", "Car", "Racer", "Best Lap", "Live Lap", "Laps"]
      : ["Pos", "Car", "Racer", "Best Lap", "Live Lap", "Laps"];

    return dataTable(
      columns,
      visibleEntries.map(
        (entry) => `
          <tr class="${entry.position === 1 ? "leader-row" : ""}${Number.isFinite(entry.finishPlace) ? " finish-row" : ""}">
            <td><span class="position-badge${finishOrderActive ? " finish-place-badge" : ""}">${escapeHtml(
              finishOrderActive && Number.isFinite(entry.finishPlace)
                ? formatOrdinal(entry.finishPlace)
                : String(entry.position)
            )}</span></td>
            <td><span class="car-badge">${escapeHtml(entry.carNumber || "--")}</span></td>
            <td>
              <div class="driver-cell">
                <strong>${escapeHtml(entry.name)}</strong>
                <span>${escapeHtml(
                  finishOrderActive
                    ? Number.isFinite(entry.finishPlace)
                      ? `${formatOrdinal(entry.finishPlace)} place over the line`
                      : "Awaiting finish line"
                    : formatDeltaToLeader(entry, leaderBestLapMs)
                )}</span>
              </div>
            </td>
            <td class="timing-cell ${entry.bestLapTimeMs === leaderBestLapMs ? "is-best" : ""}">${escapeHtml(formatLap(entry.bestLapTimeMs))}</td>
            <td class="timing-cell">${escapeHtml(formatLap(entry.currentLapTimeMs))}</td>
            <td class="timing-cell">${entry.lapCount}</td>
          </tr>
        `
      ),
      { wrapClass, tableClass }
    );
  }

  function lapTrackShortName(name) {
    const firstToken = String(name || "").trim().split(/\s+/)[0] || "";
    if (firstToken.length <= 10) {
      return firstToken;
    }

    return `${firstToken.slice(0, 9)}...`;
  }

  function lapTrackSeed(value) {
    return String(value || "")
      .split("")
      .reduce((hash, character) => ((hash * 33 + character.charCodeAt(0)) % 9973), 17);
  }

  function getSimulationMeta(snapshot = state.raceSnapshot) {
    return snapshot.simulation || createEmptyRaceSnapshot().simulation;
  }

  function simulationStatusTone(status) {
    if (status === "ACTIVE") {
      return "warning";
    }

    if (status === "READY") {
      return "safe";
    }

    if (status === "COMPLETED") {
      return "danger";
    }

    return "idle";
  }

  function buildLapTrackerEstimateModel(nowMs = Date.now()) {
    const snapshot = state.raceSnapshot;
    const activeSession = getDisplaySession();
    if (!activeSession || activeSession.racers.length === 0) {
      return [];
    }

    const simulation = getSimulationMeta(snapshot);
    const leaderboardEntries = getDisplayLeaderboardEntries(snapshot);
    const leaderboardByRacerId = new Map(
      leaderboardEntries.map((entry) => [entry.racerId, entry])
    );
    const simulationByRacerId = new Map(
      simulation.racers.map((entry) => [entry.racerId, entry])
    );
    const baselineSamples = [
      ...leaderboardEntries.map((entry) => entry.bestLapTimeMs),
      ...activeSession.racers.map((racer) => racer.bestLapTimeMs),
    ].filter((value) => Number.isFinite(value) && value > 0);
    const baselineLapMs = baselineSamples.length
      ? clamp(
          Math.round(
            baselineSamples.reduce((sum, value) => sum + value, 0) / baselineSamples.length
          ),
          18000,
          120000
        )
      : 45000;
    const syncTimeMs = parseTimestampMs(snapshot.serverTime ?? state.lastSyncAt) ?? nowMs;
    const liveAdvanceMs =
      snapshot.state === "RUNNING" || snapshot.state === "FINISHED"
        ? Math.max(0, nowMs - syncTimeMs)
        : 0;
    const orderedRacers = activeSession.racers.slice().sort((left, right) => {
      const leftEntry = leaderboardByRacerId.get(left.id);
      const rightEntry = leaderboardByRacerId.get(right.id);
      const leftOrder = Number.isFinite(leftEntry?.position) ? leftEntry.position : Number.MAX_SAFE_INTEGER;
      const rightOrder = Number.isFinite(rightEntry?.position) ? rightEntry.position : Number.MAX_SAFE_INTEGER;

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return compareRacers(left, right);
    });
    const racerCount = orderedRacers.length;

    return orderedRacers.map((racer, index) => {
      const entry = leaderboardByRacerId.get(racer.id);
      const simulationEntry = simulationByRacerId.get(racer.id);
      const seed = lapTrackSeed(`${racer.id}:${racer.carNumber || racer.name}`);
      const seedUnit = (seed % 1000) / 1000;
      const lapCount = entry?.lapCount ?? racer.lapCount ?? 0;
      const bestLapMs = Number.isFinite(entry?.bestLapTimeMs)
        ? entry.bestLapTimeMs
        : Number.isFinite(racer.bestLapTimeMs)
          ? racer.bestLapTimeMs
          : null;
      const reportedCurrentLapMs = Number.isFinite(entry?.currentLapTimeMs)
        ? entry.currentLapTimeMs + liveAdvanceMs
        : null;
      const elapsedFromCrossingMs = Number.isFinite(racer.lastCrossingTimestampMs)
        ? Math.max(0, nowMs - racer.lastCrossingTimestampMs)
        : null;
      const estimatedLapMs = clamp(
        Math.round(
          Math.max(
            bestLapMs ? bestLapMs * (1.02 + seedUnit * 0.06) : 0,
            baselineLapMs * (0.92 + seedUnit * 0.16),
            Number.isFinite(reportedCurrentLapMs)
              ? reportedCurrentLapMs + 2200
              : Number.isFinite(elapsedFromCrossingMs)
                ? elapsedFromCrossingMs + 2600
                : 0
          )
        ),
        18000,
        120000
      );
      const fallbackBaseProgress = clamp(
        0.12 + ((racerCount - index) / Math.max(racerCount, 1)) * 0.58 + seedUnit * 0.06,
        0.08,
        0.84
      );
      const sparseDriftProgress = clamp(
        (fallbackBaseProgress + liveAdvanceMs / Math.max(estimatedLapMs * (0.88 + seedUnit * 0.2), 1)) %
          1,
        0.05,
        0.985
      );
      let lapProgress = simulation.active && simulationEntry
        ? clamp(simulationEntry.progress, 0.01, 0.995)
        : Number.isFinite(reportedCurrentLapMs)
          ? clamp(reportedCurrentLapMs / estimatedLapMs, 0.03, 0.985)
          : Number.isFinite(elapsedFromCrossingMs)
            ? clamp(elapsedFromCrossingMs / estimatedLapMs, 0.04, 0.985)
            : sparseDriftProgress;

      if ((snapshot.finishOrderActive || simulation.status === "COMPLETED") && Number.isFinite(entry?.finishPlace)) {
        lapProgress = clamp(0.982 + entry.finishPlace * 0.003, 0.982, 0.997);
      }

      return {
        id: racer.id,
        name: racer.name,
        shortName: lapTrackShortName(racer.name),
        carNumber: racer.carNumber || "--",
        lapCount,
        orderIndex: index,
        position: entry?.position ?? index + 1,
        finishPlace: entry?.finishPlace ?? racer.finishPlace ?? null,
        simulationProgress: simulationEntry?.progress ?? null,
        totalProgress: lapCount + lapProgress,
      };
    });
  }

  function lapTrackerVisualPanel() {
    const racers = buildLapTrackerEstimateModel();
    const simulation = getSimulationMeta();
    const simulationStatus = simulation.active ? "ACTIVE" : simulation.status;
    const markerMarkup = racers
      .map(
        (racer) => `
          <g class="lap-track-marker${racer.position === 1 ? " is-leader" : ""}${Number.isFinite(racer.finishPlace) ? " is-finished" : ""}" data-track-marker="${escapeHtml(racer.id)}">
            <circle class="lap-track-marker-dot" cx="0" cy="0" r="18"></circle>
            <text class="lap-track-marker-car" text-anchor="middle" x="0" y="6">${escapeHtml(racer.carNumber)}</text>
            <text class="lap-track-marker-name" text-anchor="middle" x="0" y="34">${escapeHtml(racer.shortName)}</text>
            ${
              Number.isFinite(racer.finishPlace)
                ? `<text class="lap-track-marker-place" text-anchor="middle" x="0" y="-26">${escapeHtml(formatOrdinal(racer.finishPlace))}</text>`
                : ""
            }
          </g>
        `
      )
      .join("");

    return `
      <div class="lap-track-visual" id="lap-track-estimate">
        <div class="lap-track-visual-head">
          <div>
            <p class="section-kicker">${escapeHtml(simulation.active ? "Simulation track" : "Estimated track")}</p>
            <strong class="lap-track-visual-title">${escapeHtml(
              simulation.active
                ? "Truth-driven live simulation"
                : state.raceSnapshot.finishOrderActive
                  ? "Estimated live finish"
                  : "Live estimate"
            )}</strong>
          </div>
          <span class="chip tiny-chip tone-${escapeHtml(simulationStatusTone(simulationStatus))}">${escapeHtml(
            simulation.active ? "Simulation Active" : simulationStatus === "READY" ? "Simulation Ready" : simulationStatus === "COMPLETED" ? "Simulation Complete" : "Simulation Idle"
          )}</span>
        </div>
        <svg class="lap-track-svg" viewBox="0 0 560 320" role="img" aria-label="Estimated live track view">
          <ellipse class="lap-track-lane lap-track-lane-outer" cx="280" cy="160" rx="226" ry="116"></ellipse>
          <ellipse class="lap-track-lane lap-track-lane-inner" cx="280" cy="160" rx="154" ry="58"></ellipse>
          <ellipse class="lap-track-center-line" cx="280" cy="160" rx="190" ry="88"></ellipse>
          <g class="lap-track-finish-line">
            <line x1="280" y1="42" x2="280" y2="102"></line>
            <text x="292" y="50">Finish</text>
          </g>
          <g class="lap-track-pit-lane">
            <line x1="422" y1="226" x2="506" y2="286"></line>
            <text x="430" y="220">Pit Lane</text>
          </g>
          <g class="lap-track-marker-layer">
            ${markerMarkup}
          </g>
        </svg>
      </div>
    `;
  }

  function rosterStrip(session, { emptyTitle, emptyDetail, limit = 8 } = {}) {
    if (isInitialPublicLoad()) {
      return loadingSkeleton(4);
    }

    if (!session || session.racers.length === 0) {
      return emptyState(emptyTitle, emptyDetail);
    }

    return `
      <div class="roster-pill-grid">
        ${session.racers
          .slice(0, limit)
          .map(
            (racer) => `
              <div class="roster-pill">
                <strong>${escapeHtml(racer.name)}</strong>
                <span>Car ${escapeHtml(racer.carNumber || "--")}</span>
              </div>
            `
          )
          .join("")}
      </div>
    `;
  }

  function raceControlPanel() {
    const snapshot = state.raceSnapshot;
    const activeSession = getActiveSession();
    const displayEntries = getDisplayLeaderboardEntries(snapshot);
    const accessReason = staffAccessReason();
    const flagMeta = getFlagMeta(snapshot);
    const checkeredActive = snapshot.state === "FINISHED";
    const lockedActive = snapshot.state === "LOCKED";
    const startReason = firstReason(
      accessReason,
      state.pending ? "Wait for current request." : "",
      activeSession ? "" : "Stage a session first.",
      snapshot.state === "STAGING" ? "" : "Only from staging."
    );
    const finishReason = firstReason(
      accessReason,
      state.pending ? "Wait for current request." : "",
      snapshot.state === "RUNNING" ? "" : "Only while running."
    );
    const lockReason = firstReason(
      accessReason,
      state.pending ? "Wait for current request." : "",
      snapshot.state === "FINISHED" ? "" : "Only after finish."
    );
    const modeReason = firstReason(
      accessReason,
      state.pending ? "Wait for current request." : "",
      snapshot.state === "RUNNING" ? "" : "Modes only during running."
    );
    const modeVisible = snapshot.state === "RUNNING";
    const authorityNote = flagMeta.detail;

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

    return panel(
      "Race Control Console",
      `
        <div class="race-control-console">
          <div class="race-control-top-grid">
            <div class="race-control-state-summary tone-${flagMeta.tone} ${checkeredActive ? "checkered-stage" : ""} ${lockedActive ? "locked-stage" : ""}">
              <div class="race-control-state-copy">
                <p class="section-kicker">Current authority</p>
                <div class="race-control-state-line">
                  <strong class="command-stage-title">${escapeHtml(STATE_META[snapshot.state]?.label || snapshot.state)}</strong>
                  <span class="race-control-session-name">${escapeHtml(activeSession ? activeSession.name : "No session staged")}</span>
                </div>
                <span class="race-control-state-note">${escapeHtml(authorityNote)}</span>
              </div>
              <div class="race-control-actions">
                <div class="race-command race-command-start ${startReason ? "is-blocked" : "is-live"}">
                  ${buttonMarkup({ id: "race-start-btn", label: "Start Race", disabled: Boolean(startReason) })}
                  <p class="command-hint">${escapeHtml(startReason || "Begin the live race.")}</p>
                </div>
                <div class="race-command race-command-finish ${finishReason ? "is-blocked" : "is-live"}">
                  ${buttonMarkup({ id: "race-finish-btn", label: "Finish Race", variant: "warning", disabled: Boolean(finishReason) })}
                  <p class="command-hint">${escapeHtml(finishReason || "Call checkered and keep post-finish laps open.")}</p>
                </div>
                <div class="race-command race-command-lock ${lockReason ? "is-blocked" : "is-live"}">
                  ${buttonMarkup({ id: "race-lock-btn", label: "End + Lock", variant: "danger", disabled: Boolean(lockReason) })}
                  <p class="command-hint">${escapeHtml(lockReason || "Close scoring and lock the result.")}</p>
                </div>
              </div>
            </div>
            <div class="race-control-sidecar">
              ${raceControlConsoleStatusBody()}
              <div class="race-control-mode-shell">
                <div class="race-control-mode-block">
                  <p class="section-kicker">Flag mode</p>
                  <strong class="summary-value">${escapeHtml(MODE_META[snapshot.mode]?.label || snapshot.mode)}</strong>
                </div>
                ${
                  modeVisible
                    ? `
                      <div class="mode-grid">${modeButtons}</div>
                    `
                    : `
                      <div class="mode-standby">
                        <strong>Mode controls hidden</strong>
                        <span>${escapeHtml(modeReason)}</span>
                      </div>
                    `
                }
              </div>
            </div>
          </div>
          <div class="race-control-live-order-card">
            <div class="race-control-live-order-head">
              <div>
                <p class="section-kicker">Live order</p>
                <strong class="queue-title">Track order stays visible while controls stay compact.</strong>
              </div>
              <span class="chip tiny-chip">${displayEntries.length} racers</span>
            </div>
            ${leaderboardTable(displayEntries, {
              wrapClass: "race-order-scroll",
              finishOrderActive: snapshot.finishOrderActive,
            })}
          </div>
        </div>
      `,
      "warning",
      "staff-main-panel race-control-panel"
    );
  }

  function lapTrackerPanel() {
    const snapshot = state.raceSnapshot;
    const activeSession = getDisplaySession();
    const simulation = getSimulationMeta(snapshot);
    const lapAllowed = Boolean(snapshot.lapEntryAllowed);
    const flagMeta = getFlagMeta(snapshot);
    const lapReason = firstReason(
      staffAccessReason(),
      state.pending ? "Wait for the current request to finish." : "",
      activeSession ? "" : "Stage a session before lap entry.",
      simulation.active ? "Simulation is driving lap truth right now." : "",
      lapAllowed ? "" : "Lap entry is only available while RUNNING or FINISHED."
    );
    const simulateReason = firstReason(
      staffAccessReason(),
      state.pending ? "Wait for the current request to finish." : "",
      activeSession ? "" : "Stage a session before starting simulation.",
      snapshot.state === "STAGING" ? "" : "Simulation can only start from STAGING.",
      activeSession && activeSession.racers.length > 0 ? "" : "Simulation needs staged racers.",
      simulation.active ? "Simulation is already active." : "",
      snapshot.state === "LOCKED" ? "Simulation is unavailable once the race is locked." : ""
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
        "Lap Entry Console",
        `
          <div class="lap-tracker-shell">
            <div class="lap-stage tone-${flagMeta.tone}">
              <div class="lap-entry-shell">
                <div class="lap-entry-head">
                  <div class="lap-stage-copy">
                    <p class="section-kicker">Authoritative entry</p>
                    <strong class="command-stage-title">${escapeHtml(activeSession ? activeSession.name : "Awaiting staged session")}</strong>
                    <span class="command-stage-detail">${escapeHtml(
                      simulation.active
                        ? "Simulation is advancing the truth. Manual taps stay locked until it stops."
                        : lapAllowed
                          ? "Tap the racer crossing the line."
                          : "Input unlocks during RUNNING or FINISHED."
                    )}</span>
                  </div>
                  <div class="telemetry-tags lap-tracker-head-tags">
                    <span class="telemetry-tag tone-${flagMeta.tone}">${escapeHtml(flagMeta.label)}</span>
                    <span class="telemetry-tag tone-${simulation.active ? "warning" : lapAllowed ? "safe" : "danger"}">${escapeHtml(
                      simulation.active ? "Simulation driving" : lapAllowed ? "Lap entry open" : "Lap entry blocked"
                    )}</span>
                    <span class="telemetry-tag tone-${escapeHtml(simulationStatusTone(simulation.active ? "ACTIVE" : simulation.status))}">${escapeHtml(
                      simulation.active ? "Simulation Active" : simulation.status === "READY" ? "Simulation Ready" : simulation.status === "COMPLETED" ? "Simulation Complete" : "Simulation Idle"
                    )}</span>
                    ${buttonMarkup({
                      id: "simulate-race-btn",
                      label: "Simulate Race",
                      variant: "warning",
                      size: "mini",
                      disabled: Boolean(simulateReason),
                    })}
                  </div>
                </div>
                <div class="car-grid lap-grid lap-entry-grid">${buttons}</div>
              </div>
            </div>
            <div class="lap-tracker-sidecar">
              ${lapTrackerVisualPanel()}
            </div>
          </div>
          ${overlay}
        `,
        "danger",
        "staff-main-panel lap-tracker-panel"
      ),
    ].join("");
  }

  function publicStatusPanel() {
    const snapshot = state.raceSnapshot;
    const flagMeta = getFlagMeta(snapshot);
    const activeSession = getDisplaySession();
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
    const activeSession = hasHeldResults() && state.raceSnapshot.lockedSession
      ? state.raceSnapshot.lockedSession
      : getDisplaySession();
    const displayEntries = getDisplayLeaderboardEntries();
    const leader = displayEntries[0] || null;
    const flagMeta = getFlagMeta();
    const countdownLabel = formatTime(state.raceSnapshot.remainingSeconds);
    const leaderBestLap = leader ? formatLap(leader.bestLapTimeMs) : "--";
    const leaderCurrentLap = leader ? formatLap(leader.currentLapTimeMs) : "--";
    return [
      panel(
        "Timing Tower",
        `
          <div class="leaderboard-top-strip">
            <div class="glance-metric-grid">
              ${kpiPill("State", STATE_META[state.raceSnapshot.state]?.label || state.raceSnapshot.state, flagMeta.tone)}
              ${kpiPill("Flag", flagMeta.label, flagMeta.tone)}
              ${kpiPill("Countdown", countdownLabel, "danger")}
              ${kpiPill("Best Lap", leaderBestLap, "safe")}
            </div>
            <div class="leaderboard-leader-meta${finishedClass()}">
              <p class="section-kicker">${escapeHtml(
                state.raceSnapshot.finishOrderActive ? "Finish order" : "Leader"
              )}</p>
              <strong class="leaderboard-leader-name">${escapeHtml(leader ? leader.name : "Waiting for first lap")}</strong>
              <span class="leaderboard-leader-session">${escapeHtml(activeSession ? activeSession.name : "No active session")}</span>
              <span class="leaderboard-leader-laps">${escapeHtml(
                state.raceSnapshot.finishOrderActive && Number.isFinite(leader?.finishPlace)
                  ? `${formatOrdinal(leader.finishPlace)} place over the line · Best ${leaderBestLap}`
                  : `Best ${leaderBestLap} · Live ${leaderCurrentLap}`
              )}</span>
              <span class="leaderboard-state-detail">${escapeHtml(flagMeta.detail)}</span>
            </div>
          </div>
          <div class="leaderboard-table-shell">
            ${leaderboardTable(displayEntries, {
              wrapClass: "leaderboard-scroll",
              finishOrderActive: state.raceSnapshot.finishOrderActive,
            })}
          </div>
        `,
        flagMeta.tone,
        `panel-wide public-display-panel leaderboard-panel${finishedClass()}`
      ),
    ].join("");
  }

  function nextRacePanels() {
    const activeSession = state.raceSnapshot.activeSession;
    const pitLaneSession =
      state.raceSnapshot.state !== "RUNNING" && state.raceSnapshot.lockedSession
        ? state.raceSnapshot.lockedSession
        : null;
    const onTrackSession = pitLaneSession || activeSession || getDisplaySession();
    const queued = pitLaneSession
      ? activeSession || state.raceSnapshot.nextSession || getQueuedSessions()[0] || null
      : getQueuedSessions()[0] || null;
    const flagMeta = getFlagMeta();
    const runningRace = state.raceSnapshot.state === "RUNNING";
    const pitReturnActive = Boolean(pitLaneSession);
    const topThreeEntries = runningRace ? getDisplayLeaderboardEntries().slice(0, 3) : [];
    const topThreeMarkup = runningRace
      ? topThreeEntries.length > 0
        ? `
          <div class="next-race-top-three-grid">
            ${topThreeEntries
              .map((entry, index) => {
                const timingValue = Number.isFinite(entry?.bestLapTimeMs)
                  ? formatLap(entry.bestLapTimeMs)
                  : "Lap pending";
                return `
                  <article class="next-race-top-three-card place-${index + 1}">
                    <span class="next-race-top-place">${escapeHtml(formatOrdinal(index + 1))}</span>
                    <strong>${escapeHtml(entry.name || `Car ${entry.carNumber || "--"}`)}</strong>
                    <span class="next-race-top-time">${escapeHtml(timingValue)}</span>
                  </article>
                `;
              })
              .join("")}
          </div>
        `
        : `
          <div class="next-race-top-three-empty">
            <strong>Current race Top 3 is waiting on live laps.</strong>
            <span>As soon as crossing data arrives, the lead trio appears here automatically.</span>
          </div>
        `
      : `
        <div class="next-race-top-three-idle">
          <strong>Current race Top 3 appears once the race is running.</strong>
        </div>
      `;
    const trackStateCopy = pitReturnActive
      ? "This session has finished. Drivers should proceed to the pit lane."
      : STATE_META[state.raceSnapshot.state]?.detail || "Waiting for the next session to be staged.";
    const nextStateCopy = pitReturnActive
      ? queued
        ? "Next lineup is now in focus for the next safe start."
        : "No next lineup is staged yet."
      : queued
        ? "Next lineup waiting to take the track."
        : "Front desk has not staged the next lineup yet.";

    return [
      panel(
        "Race Board",
        `
          <div class="next-race-status-strip">
            <div class="next-race-status-copy">
              <p class="section-kicker">Race board</p>
              <strong class="next-race-status-title">${escapeHtml(flagMeta.label)}</strong>
              <span class="public-state-detail">${escapeHtml(flagMeta.detail)}</span>
            </div>
            <div class="glance-metric-grid">
              ${kpiPill("Track", activeSession ? activeSession.name : "No active session", activeSession ? "warning" : "danger")}
              ${kpiPill("On Deck", queued ? queued.name : "Waiting", queued ? "safe" : "warning")}
              ${kpiPill("Current Racers", String(activeSession ? activeSession.racers.length : 0), activeSession ? "safe" : "warning")}
              ${kpiPill("Next Racers", String(queued ? queued.racers.length : 0), queued ? "safe" : "warning")}
            </div>
          </div>
          <div class="session-board-grid${finishedClass()}">
            <div class="session-board tone-${escapeHtml(pitReturnActive ? "danger" : flagMeta.tone)} ${pitReturnActive ? "session-board-pit" : ""}">
              <p class="section-kicker">${escapeHtml(pitReturnActive ? "Return to pit lane" : "On track now")}</p>
              <strong>${escapeHtml(onTrackSession ? onTrackSession.name : "No active session")}</strong>
              <span>${escapeHtml(trackStateCopy)}</span>
              ${
                pitReturnActive
                  ? `<div class="next-race-pit-callout"><strong>Proceed to pit lane</strong><span>Keep this lineup moving off track before the next safe start.</span></div>`
                  : ""
              }
              ${rosterStrip(onTrackSession, {
                emptyTitle: pitReturnActive ? "Pit return roster unavailable" : "No racers on track",
                emptyDetail: pitReturnActive
                  ? "The finished session roster will appear here until the next race starts safely."
                  : "Front desk has not staged an active session yet.",
                limit: 4,
              })}
            </div>
            <div class="session-board tone-safe">
              <p class="section-kicker">Up next</p>
              <strong>${escapeHtml(queued ? queued.name : "No queued session")}</strong>
              <span>${escapeHtml(nextStateCopy)}</span>
              ${rosterStrip(queued, {
                emptyTitle: "Next lineup not ready",
                emptyDetail: "Front desk has not staged the next lineup yet.",
                limit: 4,
              })}
            </div>
          </div>
          <section class="next-race-top-three-shell">
            <div class="next-race-top-three-head">
              <div>
                <p class="section-kicker">Current race Top 3</p>
                <strong class="next-race-top-three-title">${escapeHtml(
                  runningRace ? "Live names and pace" : "Stand by for live race order"
                )}</strong>
              </div>
            </div>
            ${topThreeMarkup}
          </section>
        `,
        "warning",
        `panel-wide public-display-panel next-race-panel${finishedClass()}`
      ),
    ].join("");
  }

  function countdownPanels() {
    const activeSession = getDisplaySession();
    const queued = getQueuedSessions()[0] || null;
    const flagMeta = getFlagMeta();
    return [
      panel(
        "Race Countdown",
        `
          <div class="countdown-focus-shell">
            <div class="public-glance-copy">
              <p class="section-kicker">Primary question</p>
              <strong class="public-question">${escapeHtml(publicRouteQuestion())}</strong>
              <span class="public-state-detail">${escapeHtml(activeSession ? activeSession.name : "No active session")}</span>
            </div>
            <div class="countdown-shell tone-${escapeHtml(flagMeta.tone)}${finishedClass()}">
              <div class="countdown-board tone-${escapeHtml(flagMeta.tone)}${finishedClass()}">
                <p class="section-kicker">Official timer</p>
                <div class="countdown-digits">${escapeHtml(formatTime(state.raceSnapshot.remainingSeconds))}</div>
                <p class="hero-copy">${escapeHtml(STATE_META[state.raceSnapshot.state]?.detail || "")}</p>
              </div>
              <div class="countdown-side">
                <span class="telemetry-tag tone-${flagMeta.tone}">${escapeHtml(flagMeta.label)}</span>
                <strong>${escapeHtml(activeSession ? activeSession.name : "No active session")}</strong>
                <span>${escapeHtml(flagMeta.detail)}</span>
                ${rosterStrip(activeSession, {
                  emptyTitle: "No roster on screen",
                  emptyDetail: "Stage a session to show the active lineup.",
                  limit: 3,
                })}
                <div class="stack-list">
                  <div class="info-row"><span>State</span><strong>${escapeHtml(STATE_META[state.raceSnapshot.state]?.label || state.raceSnapshot.state)}</strong></div>
                  <div class="info-row"><span>Next</span><strong>${escapeHtml(queued ? queued.name : "Waiting")}</strong></div>
                </div>
              </div>
            </div>
          </div>
        `,
        flagMeta.tone,
        `panel-wide public-display-panel countdown-panel${finishedClass()}`
      ),
    ].join("");
  }

  function flagPanels() {
    const flagMeta = getFlagMeta();
    const displaySession = getDisplaySession();
    const flagVisualClass =
      state.raceSnapshot.flag === "SAFE"
        ? "is-safe"
        : state.raceSnapshot.flag === "HAZARD_SLOW"
          ? "is-hazard-slow"
          : state.raceSnapshot.flag === "HAZARD_STOP"
            ? "is-hazard-stop"
            : state.raceSnapshot.flag === "CHECKERED"
              ? "is-checkered"
              : "is-locked";
    return [
      panel(
        "Track State Board",
        `
          <div class="flag-shell flag-shell-minimal">
            <div class="flag-board tone-${escapeHtml(flagMeta.tone)} ${flagVisualClass}${finishedClass()}">
              <p class="section-kicker">Current flag</p>
              <span class="flag-code">${escapeHtml(flagMeta.label.toUpperCase())}</span>
              <strong class="flag-display-label">${escapeHtml(flagMeta.label)}</strong>
              <p>${escapeHtml(publicStateMeaning())}</p>
              <span class="flag-session">${escapeHtml(displaySession ? displaySession.name : "No active session")}</span>
              <span class="flag-timer">${escapeHtml(formatTime(state.raceSnapshot.remainingSeconds))}</span>
            </div>
          </div>
        `,
        flagMeta.tone,
        "panel-wide public-display-panel flag-panel"
      ),
    ].join("");
  }

  function homePanels() {
    return [
      summaryPanel(),
      panel(
        "Route Launch Board",
        `
          <div class="home-launch-shell">
            <div class="home-route-section">
              <div class="panel-heading">
                <h2>Staff Routes</h2>
              </div>
              <div class="route-card-grid compact-route-grid">
                ${["/front-desk", "/race-control", "/lap-line-tracker"].map((pathname) => routeCard(pathname)).join("")}
              </div>
            </div>
            <div class="home-route-section">
              <div class="panel-heading">
                <h2>Public Displays</h2>
              </div>
              <div class="route-card-grid compact-route-grid">
                ${["/leader-board", "/next-race", "/race-countdown", "/race-flags"].map((pathname) => routeCard(pathname)).join("")}
              </div>
            </div>
          </div>
        `,
        "warning",
        "home-launch-panel"
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

  function bindFrontDeskEvents() {
    const managedSession = getFrontDeskManagedSession();
    const sessionInput = document.getElementById("session-name-input");
    const manualCarInput = document.getElementById("manual-car-number-input");
    const assignCarBtn = document.getElementById("assign-car-btn");
    const clearCarBtn = document.getElementById("clear-car-btn");
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

    if (manualCarInput) {
      manualCarInput.addEventListener("input", (event) => {
        state = {
          ...state,
          manualAssignmentForm: {
            ...state.manualAssignmentForm,
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
          (payload) => {
            const savedSessionId = payload?.session?.id ? String(payload.session.id) : state.frontDeskSessionId;
            setState({
              sessionForm: {
                id: null,
                name: "",
              },
              frontDeskSessionId: savedSessionId || state.frontDeskSessionId,
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
        if (!managedSession) {
          setNotice("danger", "Create or choose a saved session before adding racers.", 4000);
          return;
        }

        const formState = getFrontDeskFormState();
        if (formState.duplicateCarRacer) {
          setNotice(
            "danger",
            `Car ${state.racerForm.carNumber.trim()} is already assigned to ${formState.duplicateCarRacer.name}.`,
            4000
          );
          return;
        }

        const name = state.racerForm.name.trim();
        if (!name) {
          setNotice("danger", "Racer name is required.", 4000);
          return;
        }

        const autoAssignmentMode = !manualAssignmentEnabled();
        const carNumber = state.racerForm.carNumber.trim();
        const body = autoAssignmentMode
          ? { name }
          : {
              name,
              carNumber: carNumber === "" ? null : carNumber,
            };

        runAction(
          () => {
            if (state.racerForm.id) {
              return apiRequest(
                `/api/sessions/${managedSession.id}/racers/${state.racerForm.id}`,
                {
                  method: "PATCH",
                  body,
                }
              );
            }

            return apiRequest(`/api/sessions/${managedSession.id}/racers`, {
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

    if (assignCarBtn) {
      assignCarBtn.addEventListener("click", () => {
        const assignmentState = getManualAssignmentState();
        if (!assignmentState?.activeSession || !assignmentState.selectedRacer) {
          setNotice("danger", "Choose a staged racer before assigning a car.", 4000);
          return;
        }

        runAction(
          () =>
            apiRequest(
              `/api/sessions/${assignmentState.activeSession.id}/racers/${assignmentState.selectedRacer.id}`,
              {
                method: "PATCH",
                body: { carNumber: assignmentState.carNumber },
              }
            ),
          `Car ${assignmentState.carNumber} assigned to ${assignmentState.selectedRacer.name}.`,
          () => {
            setState({
              manualAssignmentForm: {
                racerId: assignmentState.selectedRacer.id,
                carNumber: assignmentState.carNumber,
              },
            });
          }
        );
      });
    }

    if (clearCarBtn) {
      clearCarBtn.addEventListener("click", () => {
        const assignmentState = getManualAssignmentState();
        if (!assignmentState?.activeSession || !assignmentState.selectedRacer) {
          setNotice("danger", "Choose a staged racer before clearing an assignment.", 4000);
          return;
        }

        runAction(
          () =>
            apiRequest(
              `/api/sessions/${assignmentState.activeSession.id}/racers/${assignmentState.selectedRacer.id}`,
              {
                method: "PATCH",
                body: { carNumber: null },
              }
            ),
          `Car assignment cleared for ${assignmentState.selectedRacer.name}.`,
          () => {
            setState({
              manualAssignmentForm: {
                racerId: assignmentState.selectedRacer.id,
                carNumber: "",
              },
            });
          }
        );
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
          frontDeskSessionId: session.id,
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
        const racer = managedSession?.racers.find((item) => item.id === node.dataset.racerId);
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
        if (!managedSession) {
          return;
        }

        runAction(
          () =>
            apiRequest(`/api/sessions/${managedSession.id}/racers/${node.dataset.racerId}`, {
              method: "DELETE",
            }),
          "Racer removed."
        );
      });
    });

    document.querySelectorAll("[data-action='select-manual-racer']").forEach((node) => {
      node.addEventListener("click", () => {
        const racer = activeSession?.racers.find((item) => item.id === node.dataset.racerId);
        if (!racer) {
          return;
        }

        setState({
          manualAssignmentForm: {
            racerId: racer.id,
            carNumber: racer.carNumber || "",
          },
        });
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
    const simulateBtn = document.getElementById("simulate-race-btn");

    if (simulateBtn) {
      simulateBtn.addEventListener("click", () => {
        runAction(
          () =>
            apiRequest("/api/race/simulate", {
              method: "POST",
              body: {},
            }),
          "Simulation started.",
          () => {
            setNotice("success", "Simulation is driving the staged session.", 2200);
          }
        );
      });
    }

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

  function stopLapTrackAnimation() {
    if (lapTrackVisualState.frameId && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(lapTrackVisualState.frameId);
      lapTrackVisualState.frameId = 0;
    }
    lapTrackVisualState.lastFrameTs = 0;
    if (typeof cancelAnimationFrame !== "function") {
      lapTrackVisualState.frameId = 0;
    }
  }

  function lapTrackPoint(progress, offset = 0) {
    const normalized = ((progress % 1) + 1) % 1;
    const angle = (-Math.PI / 2) + (Math.PI * 2 * normalized);
    const centerX = 280;
    const centerY = 160;
    const radiusX = 190 + offset;
    const radiusY = 88 + (offset * 0.58);
    return {
      x: centerX + Math.cos(angle) * radiusX,
      y: centerY + Math.sin(angle) * radiusY,
    };
  }

  function applyLapTrackOverlapOffsets(items) {
    if (items.length <= 1) {
      return new Map(items.map((item) => [item.id, 0]));
    }

    const sorted = items.slice().sort((left, right) => left.progress - right.progress);
    const clusters = [];
    let cluster = [sorted[0]];

    for (let index = 1; index < sorted.length; index += 1) {
      if ((sorted[index].progress - sorted[index - 1].progress) < 0.04) {
        cluster.push(sorted[index]);
        continue;
      }
      clusters.push(cluster);
      cluster = [sorted[index]];
    }
    clusters.push(cluster);

    if (
      clusters.length > 1 &&
      ((sorted[0].progress + 1) - sorted[sorted.length - 1].progress) < 0.04
    ) {
      clusters[0] = [...clusters[clusters.length - 1], ...clusters[0]];
      clusters.pop();
    }

    const offsets = new Map();
    const pattern = [0, 18, -18, 30, -30, 42, -42, 54];
    clusters.forEach((group) => {
      group.forEach((item, index) => {
        offsets.set(item.id, pattern[index] ?? 0);
      });
    });

    return offsets;
  }

  function frameLapTrackVisual(frameTs) {
    const root = document.getElementById("lap-track-estimate");
    if (!root || route !== "/lap-line-tracker") {
      stopLapTrackAnimation();
      return;
    }

    const nowMs = Date.now();
    const model = buildLapTrackerEstimateModel(nowMs);
    const nextIds = new Set(model.map((item) => item.id));
    const smoothing = lapTrackVisualState.lastFrameTs
      ? 1 - Math.exp(-(Math.min(frameTs - lapTrackVisualState.lastFrameTs, 96) / 180))
      : 1;
    lapTrackVisualState.lastFrameTs = frameTs;

    lapTrackVisualState.markers.forEach((_, markerId) => {
      if (!nextIds.has(markerId)) {
        lapTrackVisualState.markers.delete(markerId);
      }
    });

    const displayItems = model.map((item) => {
      const previous = lapTrackVisualState.markers.get(item.id) || {
        displayTotalProgress: item.totalProgress,
      };
      previous.displayTotalProgress += (item.totalProgress - previous.displayTotalProgress) * smoothing;
      lapTrackVisualState.markers.set(item.id, previous);
      return {
        ...item,
        progress: ((previous.displayTotalProgress % 1) + 1) % 1,
      };
    });
    const offsets = applyLapTrackOverlapOffsets(displayItems);

    displayItems.forEach((item) => {
      const marker = root.querySelector(`[data-track-marker=\"${item.id}\"]`);
      if (!marker) {
        return;
      }

      const point = lapTrackPoint(item.progress, offsets.get(item.id) ?? 0);
      marker.setAttribute("transform", `translate(${point.x.toFixed(2)} ${point.y.toFixed(2)})`);
      marker.classList.toggle("is-leader", item.position === 1);
    });

    lapTrackVisualState.frameId = requestAnimationFrame(frameLapTrackVisual);
  }

  function ensureLapTrackAnimation() {
    if (typeof requestAnimationFrame !== "function") {
      return;
    }

    if (route !== "/lap-line-tracker") {
      stopLapTrackAnimation();
      return;
    }

    if (!lapTrackVisualState.frameId) {
      lapTrackVisualState.frameId = requestAnimationFrame(frameLapTrackVisual);
    }
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
