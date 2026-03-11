const {
  SOCKET_EVENTS,
  raceSnapshotSchema,
  raceTickSchema,
  leaderboardUpdateSchema,
} = require("./socket/contract");

const DRIVER_POOL = [
  { id: "avery-stone", name: "Avery Stone", kart: "K-12", paceBiasMs: -360, lane: "A" },
  { id: "mila-hart", name: "Mila Hart", kart: "K-08", paceBiasMs: -210, lane: "B" },
  { id: "noah-vale", name: "Noah Vale", kart: "K-15", paceBiasMs: -120, lane: "C" },
  { id: "ruby-lane", name: "Ruby Lane", kart: "K-03", paceBiasMs: 40, lane: "D" },
  { id: "leo-frost", name: "Leo Frost", kart: "K-19", paceBiasMs: 120, lane: "E" },
  { id: "ivy-kent", name: "Ivy Kent", kart: "K-05", paceBiasMs: 210, lane: "F" },
  { id: "jax-quinn", name: "Jax Quinn", kart: "K-17", paceBiasMs: -80, lane: "A" },
  { id: "sara-north", name: "Sara North", kart: "K-10", paceBiasMs: 85, lane: "B" },
  { id: "owen-blaze", name: "Owen Blaze", kart: "K-07", paceBiasMs: -10, lane: "C" },
  { id: "zoe-torque", name: "Zoe Torque", kart: "K-22", paceBiasMs: 180, lane: "D" },
];

const STAGING_SECONDS = 12;
const FINISHED_SECONDS = 10;
const LOCKED_SECONDS = 8;
const TOTAL_LAPS = 12;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rotateRoster(raceNumber) {
  const startIndex = ((raceNumber - 1) * 2) % DRIVER_POOL.length;
  const roster = [];

  for (let index = 0; index < 6; index += 1) {
    const driver = DRIVER_POOL[(startIndex + index) % DRIVER_POOL.length];
    roster.push({
      id: driver.id,
      name: driver.name,
      kart: driver.kart,
      lane: driver.lane,
      paceBiasMs: driver.paceBiasMs,
    });
  }

  return roster;
}

function buildPhaseState(elapsedSeconds, raceDurationSeconds) {
  const totalCycleSeconds =
    STAGING_SECONDS + raceDurationSeconds + FINISHED_SECONDS + LOCKED_SECONDS;
  const cycleOffset = elapsedSeconds % totalCycleSeconds;
  const raceNumber = Math.floor(elapsedSeconds / totalCycleSeconds) + 1;

  if (cycleOffset < STAGING_SECONDS) {
    return {
      phase: "STAGING",
      phaseLabel: "Grid is loading for the next green flag",
      phaseElapsedSeconds: cycleOffset,
      countdownSeconds: STAGING_SECONDS - cycleOffset,
      runningElapsedSeconds: 0,
      progressRatio: cycleOffset / STAGING_SECONDS,
      raceNumber,
    };
  }

  if (cycleOffset < STAGING_SECONDS + raceDurationSeconds) {
    const runningElapsedSeconds = cycleOffset - STAGING_SECONDS;
    return {
      phase: "RUNNING",
      phaseLabel: "Race is live on track",
      phaseElapsedSeconds: runningElapsedSeconds,
      countdownSeconds: raceDurationSeconds - runningElapsedSeconds,
      runningElapsedSeconds,
      progressRatio: runningElapsedSeconds / raceDurationSeconds,
      raceNumber,
    };
  }

  if (cycleOffset < STAGING_SECONDS + raceDurationSeconds + FINISHED_SECONDS) {
    const finishedElapsedSeconds =
      cycleOffset - STAGING_SECONDS - raceDurationSeconds;
    return {
      phase: "FINISHED",
      phaseLabel: "Checkered flag called, results are freezing",
      phaseElapsedSeconds: finishedElapsedSeconds,
      countdownSeconds: FINISHED_SECONDS - finishedElapsedSeconds,
      runningElapsedSeconds: raceDurationSeconds,
      progressRatio: finishedElapsedSeconds / FINISHED_SECONDS,
      raceNumber,
    };
  }

  const lockedElapsedSeconds =
    cycleOffset - STAGING_SECONDS - raceDurationSeconds - FINISHED_SECONDS;
  return {
    phase: "LOCKED",
    phaseLabel: "Track is locked while marshals clear the lane",
    phaseElapsedSeconds: lockedElapsedSeconds,
    countdownSeconds: LOCKED_SECONDS - lockedElapsedSeconds,
    runningElapsedSeconds: raceDurationSeconds,
    progressRatio: lockedElapsedSeconds / LOCKED_SECONDS,
    raceNumber,
  };
}

function buildFlagState(phaseState) {
  if (phaseState.phase === "STAGING") {
    return {
      code: "SAFE",
      tone: "safe",
      label: "Track Safe",
      detail: "Grid marshals are staging the next six drivers for launch.",
    };
  }

  if (phaseState.phase === "RUNNING") {
    if (phaseState.countdownSeconds <= 10) {
      return {
        code: "HAZARD",
        tone: "warning",
        label: "Final Laps",
        detail: "Closing laps are active. Hold lines and prepare for checkered.",
      };
    }

    return {
      code: "SAFE",
      tone: "safe",
      label: "Green Running",
      detail: "Live timing is stable and the race is under green conditions.",
    };
  }

  if (phaseState.phase === "FINISHED") {
    return {
      code: "FINISHED",
      tone: "safe",
      label: "Checkered",
      detail: "Results are locked in visually while podium order settles.",
    };
  }

  return {
    code: "STOP",
    tone: "danger",
    label: "Track Locked",
    detail: "Do not send new racers while marshals reset the circuit.",
  };
}

function buildLeaderboardEntries(phaseState, roster) {
  const runningElapsedSeconds = phaseState.runningElapsedSeconds;
  const stageFactor = runningElapsedSeconds === 0 ? 0 : 1;

  return roster
    .map((driver, index) => {
      const rawLaps =
        runningElapsedSeconds === 0
          ? 0
          : Math.floor((runningElapsedSeconds * (1.02 - index * 0.045)) / 7);
      const laps = clamp(rawLaps, 0, TOTAL_LAPS);
      const bestLapMs = clamp(
        45400 + index * 240 + driver.paceBiasMs - phaseState.raceNumber * 25,
        42850,
        48900
      );
      const lastLapMs =
        stageFactor === 0
          ? null
          : clamp(
              bestLapMs + ((phaseState.phaseElapsedSeconds + index * 3) % 5) * 120,
              bestLapMs,
              bestLapMs + 640
            );
      const totalTimeMs =
        laps * bestLapMs + (lastLapMs || bestLapMs) + index * 310 + phaseState.raceNumber * 40;

      return {
        name: driver.name,
        kart: driver.kart,
        laps,
        bestLapMs,
        lastLapMs,
        totalTimeMs,
      };
    })
    .sort((left, right) => {
      if (right.laps !== left.laps) {
        return right.laps - left.laps;
      }

      return left.totalTimeMs - right.totalTimeMs;
    })
    .map((entry, index, leaderboard) => {
      const leader = leaderboard[0];
      const gapMs =
        index === 0
          ? 0
          : Math.max(
              0,
              entry.laps === leader.laps
                ? entry.totalTimeMs - leader.totalTimeMs
                : (leader.laps - entry.laps) * 47000 +
                    (entry.totalTimeMs - leader.totalTimeMs)
            );

      return {
        position: index + 1,
        name: entry.name,
        kart: entry.kart,
        laps: entry.laps,
        bestLapMs: entry.bestLapMs,
        lastLapMs: entry.lastLapMs,
        gapMs,
      };
    });
}

function buildSnapshotState(elapsedSeconds, raceDurationSeconds, now) {
  const phaseState = buildPhaseState(elapsedSeconds, raceDurationSeconds);
  const currentRoster = rotateRoster(phaseState.raceNumber);
  const nextRoster = rotateRoster(phaseState.raceNumber + 1);
  const flag = buildFlagState(phaseState);
  const leaderboardEntries = buildLeaderboardEntries(phaseState, currentRoster);
  const lapsCompleted = leaderboardEntries[0]?.laps || 0;
  const queueReadyCount =
    phaseState.phase === "STAGING"
      ? nextRoster.length
      : phaseState.phase === "LOCKED"
        ? 2
        : 4;
  const currentRaceTitle = `Heat ${String(phaseState.raceNumber).padStart(2, "0")}`;
  const nextRaceTitle = `Heat ${String(phaseState.raceNumber + 1).padStart(2, "0")}`;
  const scheduledInSeconds =
    phaseState.phase === "STAGING"
      ? phaseState.countdownSeconds
      : phaseState.phase === "RUNNING"
        ? phaseState.countdownSeconds + FINISHED_SECONDS + LOCKED_SECONDS + STAGING_SECONDS
        : phaseState.phase === "FINISHED"
          ? phaseState.countdownSeconds + LOCKED_SECONDS + STAGING_SECONDS
          : phaseState.countdownSeconds + STAGING_SECONDS;

  return {
    snapshot: raceSnapshotSchema.parse({
      generatedAt: now().toISOString(),
      phase: phaseState.phase,
      phaseLabel: phaseState.phaseLabel,
      countdownSeconds: phaseState.countdownSeconds,
      elapsedSeconds,
      raceDurationSeconds,
      progressRatio: Number(phaseState.progressRatio.toFixed(3)),
      currentRace: {
        number: phaseState.raceNumber,
        title: currentRaceTitle,
        status: phaseState.phase,
        totalLaps: TOTAL_LAPS,
        lapsCompleted,
        scheduledInSeconds: phaseState.phase === "STAGING" ? phaseState.countdownSeconds : 0,
        racers: currentRoster.map(({ id, name, kart, lane }) => ({
          id,
          name,
          kart,
          lane,
        })),
        pitMessage:
          phaseState.phase === "LOCKED"
            ? "Marshal hold while the finish lane clears."
            : "Pit release stays on standby until the current board rotates.",
        queueStatus:
          phaseState.phase === "RUNNING"
            ? "Race in progress"
            : phaseState.phase === "FINISHED"
              ? "Results review"
              : "Queue loading",
      },
      nextRace: {
        number: phaseState.raceNumber + 1,
        title: nextRaceTitle,
        status: "QUEUED",
        totalLaps: TOTAL_LAPS,
        lapsCompleted: 0,
        scheduledInSeconds,
        racers: nextRoster.map(({ id, name, kart, lane }) => ({
          id,
          name,
          kart,
          lane,
        })),
        pitMessage:
          phaseState.phase === "STAGING"
            ? "Pit marshal is loading helmets and confirming kart assignments."
            : "Queue remains hot so the next heat can roll immediately.",
        queueStatus: `${queueReadyCount}/${nextRoster.length} drivers race-ready`,
      },
      flag,
      queue: {
        readyCount: queueReadyCount,
        totalCount: nextRoster.length,
        pitMessage:
          phaseState.phase === "FINISHED"
            ? "Finish line cool-down active. Queue release in review."
            : "Queue board is synced to the next launch window.",
      },
      venue: "Beachside Circuit",
    }),
    tick: raceTickSchema.parse({
      generatedAt: now().toISOString(),
      phase: phaseState.phase,
      raceNumber: phaseState.raceNumber,
      countdownSeconds: phaseState.countdownSeconds,
      elapsedSeconds,
      progressRatio: Number(phaseState.progressRatio.toFixed(3)),
      flagCode: flag.code,
    }),
    leaderboard: leaderboardUpdateSchema.parse({
      generatedAt: now().toISOString(),
      raceNumber: phaseState.raceNumber,
      phase: phaseState.phase,
      entries: leaderboardEntries,
    }),
  };
}

function createPublicRaceFeed({
  raceDurationSeconds,
  tickIntervalMs = 1000,
  initialElapsedSeconds = 18,
  now = () => new Date(),
} = {}) {
  let elapsedSeconds = initialElapsedSeconds;
  let intervalHandle = null;
  let io = null;

  function getState() {
    return buildSnapshotState(elapsedSeconds, raceDurationSeconds, now);
  }

  function emitCurrentState(target) {
    const state = getState();
    target.emit(SOCKET_EVENTS.RACE_SNAPSHOT, state.snapshot);
    target.emit(SOCKET_EVENTS.RACE_TICK, state.tick);
    target.emit(SOCKET_EVENTS.LEADERBOARD_UPDATE, state.leaderboard);
    return state;
  }

  function broadcast() {
    if (!io) {
      return getState();
    }

    const state = getState();
    io.emit(SOCKET_EVENTS.RACE_SNAPSHOT, state.snapshot);
    io.emit(SOCKET_EVENTS.RACE_TICK, state.tick);
    io.emit(SOCKET_EVENTS.LEADERBOARD_UPDATE, state.leaderboard);
    return state;
  }

  function advance(seconds = 1) {
    elapsedSeconds += seconds;
    return getState();
  }

  function start(targetIo) {
    io = targetIo;
    if (intervalHandle) {
      return;
    }

    intervalHandle = setInterval(() => {
      advance(1);
      broadcast();
    }, tickIntervalMs);
  }

  function stop() {
    if (intervalHandle) {
      clearInterval(intervalHandle);
      intervalHandle = null;
    }
  }

  return {
    advance,
    broadcast,
    emitCurrentState,
    getState,
    start,
    stop,
  };
}

module.exports = {
  createPublicRaceFeed,
};
