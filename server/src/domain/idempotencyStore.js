const { DomainError } = require("./raceStore");

function createIdempotencyStore({ maxEntries = 500 } = {}) {
  const entries = new Map();

  function prune() {
    while (entries.size > maxEntries) {
      const oldestKey = entries.keys().next().value;
      entries.delete(oldestKey);
    }
  }

  async function run({ key, fingerprint, execute }) {
    if (!key) {
      return execute();
    }

    const existing = entries.get(key);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new DomainError(
          "IDEMPOTENCY_CONFLICT",
          `Idempotency key "${key}" was already used for a different request.`,
          409
        );
      }

      if (existing.state === "completed") {
        return existing.response;
      }

      return existing.promise;
    }

    let resolvePromise;
    let rejectPromise;
    const promise = new Promise((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });

    entries.set(key, {
      fingerprint,
      state: "pending",
      promise,
    });
    prune();

    try {
      const response = await execute();
      entries.set(key, {
        fingerprint,
        state: "completed",
        response,
      });
      resolvePromise(response);
      return response;
    } catch (error) {
      entries.delete(key);
      rejectPromise(error);
      throw error;
    }
  }

  return {
    run,
  };
}

module.exports = {
  createIdempotencyStore,
};
