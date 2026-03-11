import { ROUTES, resolveRoute } from "./config/routes.mjs";
import {
  AppShell,
  ConnectionStatus,
  FullscreenButton,
  KeyGateModal,
  Panel,
  TelemetryHeader,
  escapeHtml,
} from "./ui/index.mjs";
import {
  useFeatureFlags,
  useLeaderboard,
  useRaceState,
  useSocket,
  useTimer,
} from "./hooks/index.mjs";
import { renderPublicRoutePanels } from "./views/public-routes.mjs";

const appEl = document.getElementById("app");
const route = resolveRoute(window.location.pathname);
const routeConfig = ROUTES[route];

const featureFlags = useFeatureFlags();
const raceState = useRaceState();
const leaderboard = useLeaderboard();
const timer = useTimer(raceState);

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

const socketClient = useSocket({
  route,
  role: routeConfig.public ? "public" : "staff",
  onConnectionChange(connection, detail) {
    setState({
      connection,
      error: connection === "error" ? detail : "",
    });
  },
  onError(_code, message) {
    setState({ error: message });
  },
  onServerHello(payload) {
    setState({ serverHello: payload });
  },
  onRaceSnapshot(payload) {
    raceState.applySnapshot(payload);
  },
  onRaceTick(payload) {
    raceState.applyTick(payload);
  },
  onLeaderboardUpdate(payload) {
    leaderboard.applyUpdate(payload);
  },
});

featureFlags.subscribe(render);
raceState.subscribe(render);
leaderboard.subscribe(render);

async function loadBootstrap() {
  try {
    const res = await fetch("/api/bootstrap");
    const data = await res.json();
    featureFlags.setFlags(data.featureFlags || {});
    setState({ bootstrap: data });
  } catch {
    setState({ error: "Bootstrap request failed." });
  }
}

function buildHeader() {
  const flags = featureFlags.getFlags();
  const race = raceState.getState();

  const statsMarkup = routeConfig.public
    ? `
        <div class="header-chip-row">
          <span class="chip">${escapeHtml(race.currentRace.title)}</span>
          <span class="chip">${escapeHtml(race.flag.label)}</span>
          <span class="chip">FF Persistence: ${flags.persistence ? "ON" : "OFF"}</span>
        </div>
      `
    : "";

  return TelemetryHeader({
    eyebrow: "Beachside Racetrack",
    title: routeConfig.title,
    subtitle: routeConfig.subtitle,
    statsMarkup,
    statusMarkup: ConnectionStatus({
      connection: state.connection,
      label: connectionLabel(),
      detail: routeConfig.public ? "WebSocket-only realtime feed" : "",
      compact: true,
    }),
    actionMarkup: routeConfig.public
      ? FullscreenButton({ active: Boolean(document.fullscreenElement) })
      : "",
  });
}

function summaryPanel() {
  return Panel({
    title: "Route Summary",
    kicker: "Overview",
    tone: routeConfig.accent,
    className: "span-6",
    body: `
      <p class="panel-copy">${escapeHtml(routeConfig.body)}</p>
      <div class="chip-row">
        <span class="chip">Route: ${escapeHtml(route)}</span>
        <span class="chip">${routeConfig.public ? "Public display" : routeConfig.staff ? "Staff route" : "Landing"}</span>
        <span class="chip">${routeConfig.public ? "M1 public MVP" : "Shared shell baseline"}</span>
      </div>
    `,
  });
}

function runtimePanel() {
  const bootstrap = state.bootstrap
    ? JSON.stringify(state.bootstrap, null, 2)
    : '{"status":"loading"}';
  const serverHello = state.serverHello
    ? JSON.stringify(state.serverHello, null, 2)
    : '{"status":"waiting"}';

  return Panel({
    title: "Runtime Snapshot",
    kicker: "Diagnostics",
    tone: "warning",
    className: "span-6",
    body: `
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
  });
}

function publicStatusPanel() {
  const liveState = raceState.getState();
  return Panel({
    title: "Connection Baseline",
    kicker: "Public route",
    tone: liveState.flag.tone,
    className: "span-12 compact-panel",
    body: `
      <div class="metric-grid wide">
        <div class="metric-card">
          <span class="metric-label">Connection</span>
          <strong>${escapeHtml(connectionLabel())}</strong>
        </div>
        <div class="metric-card">
          <span class="metric-label">Phase</span>
          <strong>${escapeHtml(liveState.phase)}</strong>
        </div>
        <div class="metric-card">
          <span class="metric-label">Countdown</span>
          <strong>${escapeHtml(timer.getState().formatted)}</strong>
        </div>
        <div class="metric-card">
          <span class="metric-label">Route</span>
          <strong>${escapeHtml(route)}</strong>
        </div>
      </div>
    `,
  });
}

function buildContent() {
  if (routeConfig.public) {
    return [
      publicStatusPanel(),
      renderPublicRoutePanels({
        route,
        raceState: raceState.getState(),
        leaderboard: leaderboard.getState(),
        timer: timer.getState(),
      }),
    ].join("");
  }

  return [summaryPanel(), runtimePanel()].join("");
}

async function verifyStaffKey(key) {
  const res = await fetch("/api/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ route, key }),
  });
  return { ok: res.ok };
}

function bindSharedEvents() {
  const fullscreenButton = document.getElementById("fullscreen-btn");
  if (fullscreenButton) {
    fullscreenButton.addEventListener("click", async () => {
      if (!document.documentElement.requestFullscreen) {
        return;
      }

      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    });
  }
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
      socketClient.connect(key);
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
  appEl.innerHTML = AppShell({
    route,
    header: buildHeader(),
    content: buildContent(),
    modal: routeConfig.staff
      ? KeyGateModal({
          routeTitle: routeConfig.title,
          gateStatus: state.gateStatus,
          gateKey: state.gateKey,
          gateError: state.gateError,
        })
      : "",
  });

  bindSharedEvents();
  if (routeConfig.staff) {
    bindStaffGate();
  }

  if (routeConfig.public && !publicConnectStarted) {
    publicConnectStarted = true;
    socketClient.connect();
  }
}

document.addEventListener("fullscreenchange", render);

loadBootstrap();
render();

window.RacetrackUI = {
  AppShell,
  ConnectionStatus,
  FullscreenButton,
  KeyGateModal,
  Panel,
  TelemetryHeader,
};

window.RacetrackHooks = {
  useFeatureFlags,
  useLeaderboard,
  useRaceState,
  useSocket,
  useTimer,
};
