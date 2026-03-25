function createTimerService({
  durationSeconds,
  tickIntervalMs = 1000,
  now = () => Date.now(),
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  onTick,
  onFinished,
}) {
  let intervalHandle = null;
  let endTimeMs = null;

  function getEndsAt() {
    return endTimeMs ? new Date(endTimeMs).toISOString() : null;
  }

  function getRemainingSeconds() {
    if (!endTimeMs) {
      return durationSeconds;
    }

    const millisecondsLeft = Math.max(0, endTimeMs - now());
    return Math.ceil(millisecondsLeft / 1000);
  }

  function stop() {
    if (intervalHandle) {
      clearIntervalFn(intervalHandle);
      intervalHandle = null;
    }
    endTimeMs = null;
  }

  function tick() {
    const remainingSeconds = getRemainingSeconds();
    const endsAt = getEndsAt();
    if (remainingSeconds === 0) {
      stop();
      if (typeof onFinished === "function") {
        onFinished({ remainingSeconds: 0, endsAt: null });
      }
      return;
    }

    if (typeof onTick === "function") {
      onTick({ remainingSeconds, endsAt });
    }
  }

  function start() {
    stop();
    endTimeMs = now() + durationSeconds * 1000;
    intervalHandle = setIntervalFn(tick, tickIntervalMs);
    return { remainingSeconds: durationSeconds, endsAt: getEndsAt() };
  }

  function resume({ remainingSeconds }) {
    stop();

    if (!Number.isInteger(remainingSeconds) || remainingSeconds <= 0) {
      return { remainingSeconds: 0, endsAt: null };
    }

    endTimeMs = now() + remainingSeconds * 1000;
    intervalHandle = setIntervalFn(tick, tickIntervalMs);
    return { remainingSeconds, endsAt: getEndsAt() };
  }

  function isRunning() {
    return Boolean(intervalHandle);
  }

  return {
    getEndsAt,
    getRemainingSeconds,
    isRunning,
    resume,
    start,
    stop,
  };
}

module.exports = { createTimerService };
