(() => {
  const ROUTES = {
    "/": {
      title: "Beachside Racetrack",
      subtitle: "Single-host M0 control surface",
      staff: false,
      public: false,
      accent: "safe",
      body: "Select a route from the browser path to inspect a public or staff screen skeleton.",
    },
    "/front-desk": {
      title: "Front Desk",
      subtitle: "Staff route skeleton",
      staff: true,
      public: false,
      accent: "safe",
      body: "Session setup, racer intake, and admin workflow will live here.",
    },
    "/race-control": {
      title: "Race Control",
      subtitle: "Staff route skeleton",
      staff: true,
      public: false,
      accent: "warning",
      body: "Start, mode control, finish, and lock actions will be wired here.",
    },
    "/lap-line-tracker": {
      title: "Lap Line Tracker",
      subtitle: "Staff route skeleton",
      staff: true,
      public: false,
      accent: "danger",
      body: "Large lap-entry controls will be mounted here once race flow is active.",
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

  const appEl = document.getElementById("app");
  const route = ROUTES[window.location.pathname] ? window.location.pathname : "/";
  const routeConfig = ROUTES[route];

  let socket = null;
  let publicConnectStarted = false;
  let state = {
    bootstrap: null,
    connection: "idle",
    error: "",
    serverHello: null,
    gateStatus: routeConfig.staff ? "idle" : "success",
    gateKey: "",
    gateError: "",
  };

  function setState(patch) {
    state = { ...state, ...patch };
    render();
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
    return `<button class="action-btn fullscreen-btn" id="fullscreen-btn" type="button">Fullscreen</button>`;
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

  function summaryPanel() {
    const body = `
      <p class="panel-copy">${routeConfig.body}</p>
      <div class="chip-row">
        <span class="chip">Route: ${route}</span>
        <span class="chip">${routeConfig.public ? "Public display" : routeConfig.staff ? "Staff route" : "Landing"}</span>
        <span class="chip">M0 skeleton</span>
      </div>
    `;
    return Panel("Route Summary", body);
  }

  function publicConnectPanel() {
    return Panel(
      "Public Connection Baseline",
      `
        <p class="panel-copy">This public route starts a Socket.IO handshake immediately to prove the realtime path is available.</p>
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

  function connectSocket(key) {
    if (socket) {
      socket.disconnect();
      socket = null;
    }

    setState({ connection: "connecting", error: "" });
    socket = window.io({
      auth: { route, key },
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      setState({ connection: "connected", error: "" });
      socket.emit("client:hello", { route, role: routeConfig.public ? "public" : "staff" });
    });

    socket.on("server:hello", (payload) => {
      setState({ serverHello: payload });
    });

    socket.on("connect_error", (err) => {
      setState({ connection: "error", error: err?.message || "Socket connection failed." });
    });

    socket.on("disconnect", () => {
      setState({ connection: "idle" });
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

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
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

  function render() {
    const panels = [summaryPanel()];

    if (routeConfig.public) {
      panels.push(publicConnectPanel(), publicSkeletonPanel());
    }

    panels.push(bootstrapPanel());
    appEl.innerHTML = AppShell(panels.join(""));

    bindSharedEvents();
    if (routeConfig.staff) {
      bindStaffGate();
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
