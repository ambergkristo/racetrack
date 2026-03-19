const path = require("path");
const dotenv = require("dotenv");

const REQUIRED_KEYS = [
  "FRONT_DESK_KEY",
  "RACE_CONTROL_KEY",
  "LAP_LINE_TRACKER_KEY",
];

const STAFF_ROUTE_TO_KEY = {
  "/front-desk": "FRONT_DESK_KEY",
  "/race-control": "RACE_CONTROL_KEY",
  "/lap-line-tracker": "LAP_LINE_TRACKER_KEY",
};

function loadDotenv() {
  const dotenvPath = process.env.DOTENV_PATH || path.join(process.cwd(), ".env");
  dotenv.config({ path: dotenvPath, quiet: true });
}

function parsePositiveInt(value) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function parseRaceDurationSeconds() {
  const explicit = parsePositiveInt(process.env.RACE_DURATION_SECONDS);
  if (explicit) {
    return explicit;
  }

  return process.env.NODE_ENV === "production" ? 600 : 60;
}

function parseAuthFailureDelayMs() {
  return parsePositiveInt(process.env.AUTH_FAILURE_DELAY_MS) || 500;
}

function parseBooleanFlag(value) {
  if (typeof value !== "string") {
    return false;
  }

  return value.trim().toLowerCase() === "true";
}

function assertRequiredEnv() {
  if (parseBooleanFlag(process.env.STAFF_AUTH_DISABLED)) {
    return;
  }

  const missing = REQUIRED_KEYS.filter((key) => {
    const value = process.env[key];
    return typeof value !== "string" || value.trim() === "";
  });

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

function loadEnvConfig() {
  loadDotenv();
  assertRequiredEnv();

  return {
    requiredKeys: REQUIRED_KEYS,
    staffRouteToKey: STAFF_ROUTE_TO_KEY,
    raceDurationSeconds: parseRaceDurationSeconds(),
    authFailureDelayMs: parseAuthFailureDelayMs(),
    staffAuthDisabled: parseBooleanFlag(process.env.STAFF_AUTH_DISABLED),
  };
}

module.exports = {
  loadEnvConfig,
};
