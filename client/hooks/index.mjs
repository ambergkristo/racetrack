import { SOCKET_EVENTS } from "../socket/events.mjs";

function createStore(initialState) {
  let value = initialState;
  const listeners = new Set();

  function notify() {
    listeners.forEach((listener) => listener(value));
  }

  return {
    getState() {
      return value;
    },
    setState(nextState) {
      value = nextState;
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function createDefaultRaceState() {
  return {
    ready: false,
    generatedAt: "",
    phase: "STAGING",
    phaseLabel: "Waiting for live race feed",
    countdownSeconds: 0,
    elapsedSeconds: 0,
    raceDurationSeconds: 60,
    progressRatio: 0,
    venue: "Beachside Circuit",
    flag: {
      code: "SAFE",
      tone: "safe",
      label: "Awaiting Feed",
      detail: "The public board is waiting for the first socket snapshot.",
    },
    currentRace: {
      number: 1,
      title: "Heat 01",
      status: "STAGING",
      totalLaps: 12,
      lapsCompleted: 0,
      scheduledInSeconds: 0,
      racers: [],
      pitMessage: "",
      queueStatus: "Waiting for socket feed",
    },
    nextRace: {
      number: 2,
      title: "Heat 02",
      status: "QUEUED",
      totalLaps: 12,
      lapsCompleted: 0,
      scheduledInSeconds: 0,
      racers: [],
      pitMessage: "",
      queueStatus: "Waiting for socket feed",
    },
    queue: {
      readyCount: 0,
      totalCount: 0,
      pitMessage: "No queue telemetry received yet.",
    },
  };
}

export function useFeatureFlags(initialFlags = {}) {
  const store = createStore({
    persistence: false,
    manualCarAssignment: false,
    ...initialFlags,
  });

  return {
    getFlags: store.getState,
    setFlags(flags) {
      store.setState({
        persistence: false,
        manualCarAssignment: false,
        ...flags,
      });
    },
    subscribe: store.subscribe,
  };
}

export function useRaceState(initialState = createDefaultRaceState()) {
  const store = createStore(initialState);

  return {
    getState: store.getState,
    subscribe: store.subscribe,
    applySnapshot(snapshot) {
      store.setState({
        ...snapshot,
        ready: true,
      });
    },
    applyTick(tick) {
      const current = store.getState();
      store.setState({
        ...current,
        countdownSeconds: tick.countdownSeconds,
        elapsedSeconds: tick.elapsedSeconds,
        phase: tick.phase,
        progressRatio: tick.progressRatio,
        flag: {
          ...current.flag,
          code: tick.flagCode,
        },
      });
    },
  };
}

export function useTimer(raceState) {
  function formatSeconds(totalSeconds) {
    const safeValue = Math.max(0, totalSeconds || 0);
    const minutes = Math.floor(safeValue / 60);
    const seconds = safeValue % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return {
    getState() {
      const state = raceState.getState();
      const seconds = Math.max(0, state.countdownSeconds || 0);
      return {
        seconds,
        formatted: formatSeconds(seconds),
        progressPercent: Math.round((state.progressRatio || 0) * 100),
        phase: state.phase,
      };
    },
  };
}

export function useLeaderboard() {
  const store = createStore({
    ready: false,
    generatedAt: "",
    raceNumber: 1,
    phase: "STAGING",
    entries: [],
  });

  return {
    getState: store.getState,
    subscribe: store.subscribe,
    applyUpdate(payload) {
      store.setState({
        ...payload,
        ready: true,
      });
    },
  };
}

export function useSocket({
  route,
  role,
  onConnectionChange,
  onError,
  onServerHello,
  onRaceSnapshot,
  onRaceTick,
  onLeaderboardUpdate,
} = {}) {
  let socket = null;

  function updateConnection(connection, detail = "") {
    if (onConnectionChange) {
      onConnectionChange(connection, detail);
    }
  }

  function disconnect() {
    if (!socket) {
      return;
    }

    socket.disconnect();
    socket = null;
  }

  function connect(key) {
    disconnect();
    updateConnection("connecting");

    socket = window.io({
      auth: { route, key },
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 500,
    });

    socket.on("connect", () => {
      updateConnection("connected");
      socket.emit(SOCKET_EVENTS.CLIENT_HELLO, { route, role });
    });

    socket.on(SOCKET_EVENTS.SERVER_HELLO, (payload) => {
      if (onServerHello) {
        onServerHello(payload);
      }
    });

    socket.on(SOCKET_EVENTS.RACE_SNAPSHOT, (payload) => {
      if (onRaceSnapshot) {
        onRaceSnapshot(payload);
      }
    });

    socket.on(SOCKET_EVENTS.RACE_TICK, (payload) => {
      if (onRaceTick) {
        onRaceTick(payload);
      }
    });

    socket.on(SOCKET_EVENTS.LEADERBOARD_UPDATE, (payload) => {
      if (onLeaderboardUpdate) {
        onLeaderboardUpdate(payload);
      }
    });

    socket.on(SOCKET_EVENTS.SERVER_ERROR, (payload) => {
      updateConnection("error", payload?.message || "Server error");
      if (onError) {
        onError(payload?.code || "SERVER_ERROR", payload?.message || "Server error");
      }
    });

    socket.on("connect_error", (error) => {
      updateConnection("error", error?.message || "Socket connection failed.");
      if (onError) {
        onError("CONNECT_ERROR", error?.message || "Socket connection failed.");
      }
    });

    socket.on("disconnect", () => {
      updateConnection("idle");
    });
  }

  return {
    connect,
    disconnect,
  };
}
