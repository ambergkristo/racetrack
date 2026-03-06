(() => {
  const ROUTE_CONFIG = {
    "/front-desk": { title: "Front Desk (Staff)", staff: true, public: false },
    "/race-control": { title: "Race Control (Staff)", staff: true, public: false },
    "/lap-line-tracker": {
      title: "Lap Line Tracker (Staff)",
      staff: true,
      public: false,
    },
    "/leader-board": { title: "Leader Board (Public)", staff: false, public: true },
    "/next-race": { title: "Next Race (Public)", staff: false, public: true },
    "/race-countdown": {
      title: "Race Countdown (Public)",
      staff: false,
      public: true,
    },
    "/race-flags": { title: "Race Flags (Public)", staff: false, public: true },
    "/": { title: "Racetrack M0 Home", staff: false, public: false },
  };

  const appEl = document.getElementById("app");
  const path = window.location.pathname;
  const route = ROUTE_CONFIG[path] ? path : "/";
  const config = ROUTE_CONFIG[route];

  let socket = null;
  let state = {
    bootstrap: null,
    connection: "idle",
    error: "",
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
      setState({ error: "Failed to load bootstrap info." });
    }
  }

  function isFullscreenAvailable() {
    return !!document.documentElement.requestFullscreen;
  }

  async function toggleFullscreen() {
    if (!isFullscreenAvailable()) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  }

  function setConnectionStatus(status, error = "") {
    setState({ connection: status, error });
  }

  function connectSocket(key) {
    if (socket) {
      socket.disconnect();
      socket = null;
    }

    setConnectionStatus("connecting");
    socket = window.io({
      auth: { route, key },
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      setConnectionStatus("connected");
      socket.emit("client:hello", { route });
    });

    socket.on("connect_error", (err) => {
      setConnectionStatus("error", err?.message || "Socket connection failed.");
    });

    socket.on("disconnect", () => {
      setConnectionStatus("idle");
    });
  }

  async function verifyStaffKey(key) {
    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ route, key }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  }

  function render() {
    const isPublic = config.public;
    const isStaff = config.staff;
    const statusClass = `status ${state.connection}`;
    const statusText =
      state.connection === "connected"
        ? "Socket: connected"
        : state.connection === "connecting"
        ? "Socket: connecting..."
        : state.connection === "error"
        ? `Socket: error (${state.error || "unknown"})`
        : "Socket: idle";

    appEl.innerHTML = `
      <div class="app-shell">
        <header class="header">
          <h1>${config.title}</h1>
          <div class="${statusClass}">${statusText}</div>
        </header>

        <main class="content">
          <section class="panel">
            <h2 class="route-title">${route}</h2>
            <p class="hint">M0 skeleton route. Deep-link refresh is supported.</p>
          </section>

          <section class="panel">
            <div class="controls">
              ${
                isPublic
                  ? `<button class="btn fullscreen" id="fullscreen-btn">Fullscreen</button>`
                  : ""
              }
            </div>
          </section>

          <section class="panel" id="gate-panel">
            ${
              isStaff
                ? `
                  <h3>Staff Access Key Required</h3>
                  <p class="hint">Key check happens before Socket.IO connect.</p>
                  <div class="field">
                    <label for="staff-key">Access key</label>
                    <input id="staff-key" type="password" autocomplete="off" />
                  </div>
                  <div class="controls" style="margin-top: 12px;">
                    <button class="btn" id="verify-btn">Verify & Connect</button>
                  </div>
                  <p class="error" id="gate-error"></p>
                `
                : `
                  <h3>Public Screen Connection</h3>
                  <p class="hint">This route connects immediately via Socket.IO.</p>
                `
            }
          </section>

          <section class="panel">
            <h3>Bootstrap</h3>
            <pre>${JSON.stringify(state.bootstrap || {}, null, 2)}</pre>
          </section>
        </main>
      </div>
    `;

    const fullscreenBtn = document.getElementById("fullscreen-btn");
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener("click", () => {
        toggleFullscreen().catch(() => {});
      });
    }

    if (isStaff) {
      const verifyBtn = document.getElementById("verify-btn");
      const keyInput = document.getElementById("staff-key");
      const gateError = document.getElementById("gate-error");
      verifyBtn.addEventListener("click", async () => {
        gateError.textContent = "";
        const key = keyInput.value.trim();
        if (!key) {
          gateError.textContent = "Access key is required.";
          return;
        }
        verifyBtn.disabled = true;
        verifyBtn.textContent = "Verifying...";
        try {
          const result = await verifyStaffKey(key);
          if (!result.ok) {
            gateError.textContent = "Invalid access key.";
            setConnectionStatus("idle");
            return;
          }
          connectSocket(key);
        } catch {
          gateError.textContent = "Verification failed.";
          setConnectionStatus("error", "Verification failed.");
        } finally {
          verifyBtn.disabled = false;
          verifyBtn.textContent = "Verify & Connect";
        }
      });
    } else {
      if (!socket) {
        connectSocket(undefined);
      }
    }
  }

  loadBootstrap();
  render();
})();
