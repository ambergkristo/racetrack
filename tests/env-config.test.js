const assert = require("node:assert/strict");
const { loadEnvConfig } = require("../server/src/config/env");
const { test } = require("./helpers/testHarness");

function withEnv(overrides, fn) {
  const keys = [
    "DOTENV_PATH",
    "NODE_ENV",
    "npm_lifecycle_event",
    "RACE_DURATION_SECONDS",
    "STAFF_AUTH_DISABLED",
    "FRONT_DESK_KEY",
    "RACE_CONTROL_KEY",
    "LAP_LINE_TRACKER_KEY",
  ];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

  for (const key of keys) {
    delete process.env[key];
  }

  process.env.DOTENV_PATH = "__codex_missing__.env";
  process.env.STAFF_AUTH_DISABLED = "false";
  process.env.FRONT_DESK_KEY = "front-desk-test-key";
  process.env.RACE_CONTROL_KEY = "race-control-test-key";
  process.env.LAP_LINE_TRACKER_KEY = "lap-line-test-key";

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined || value === null) {
      delete process.env[key];
      continue;
    }
    process.env[key] = value;
  }

  try {
    fn();
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    }
  }
}

test("env config defaults npm run dev to a 60-second race", () => {
  withEnv({ NODE_ENV: "development", npm_lifecycle_event: "dev" }, () => {
    const env = loadEnvConfig();
    assert.equal(env.raceDurationSeconds, 60);
  });
});

test("env config defaults npm start to a 600-second race", () => {
  withEnv({ npm_lifecycle_event: "start" }, () => {
    const env = loadEnvConfig();
    assert.equal(env.raceDurationSeconds, 600);
  });
});

test("explicit race duration override wins over lifecycle defaults", () => {
  withEnv(
    {
      NODE_ENV: "development",
      npm_lifecycle_event: "start",
      RACE_DURATION_SECONDS: "75",
    },
    () => {
      const env = loadEnvConfig();
      assert.equal(env.raceDurationSeconds, 75);
    }
  );
});
