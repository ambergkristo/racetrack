const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const { Server } = require("socket.io");
const { loadEnvConfig } = require("./src/config/env");

const PUBLIC_ROUTES = new Set([
  "/leader-board",
  "/next-race",
  "/race-countdown",
  "/race-flags",
]);

const SOCKET_TRANSPORTS = ["websocket"];

function createStaffSets(staffRouteToKey) {
  return {
    staffRoutes: new Set(Object.keys(staffRouteToKey)),
    spaRoutes: new Set(["/", ...PUBLIC_ROUTES, ...Object.keys(staffRouteToKey)]),
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verifyStaffKey(route, key, staffRouteToKey, authFailureDelayMs) {
  const envKeyName = staffRouteToKey[route];
  if (!envKeyName) {
    return { ok: false, code: "UNKNOWN_STAFF_ROUTE" };
  }

  const expected = process.env[envKeyName];
  if (key && expected && key === expected) {
    return { ok: true };
  }

  await delay(authFailureDelayMs);
  return { ok: false, code: "INVALID_KEY" };
}

function resolveStaticDir() {
  const builtDir = path.join(__dirname, "public");
  const sourceDir = path.join(__dirname, "client");
  const builtIndex = path.join(builtDir, "index.html");
  return fs.existsSync(builtIndex) ? builtDir : sourceDir;
}

function createApp() {
  const env = loadEnvConfig();
  const { staffRoutes, spaRoutes } = createStaffSets(env.staffRouteToKey);

  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: true, credentials: true },
    transports: SOCKET_TRANSPORTS,
    allowUpgrades: false,
  });
  const raceDurationSeconds = env.raceDurationSeconds;
  const staticDir = resolveStaticDir();

  app.use(express.json({ limit: "64kb" }));
  app.use(express.static(staticDir, { index: false }));

  app.get("/healthz", (_req, res) => {
    res.status(200).json({
      status: "ok",
      raceDurationSeconds,
      nodeEnv: process.env.NODE_ENV || "development",
    });
  });

  app.get("/api/bootstrap", (_req, res) => {
    res.status(200).json({
      raceDurationSeconds,
      serverTime: new Date().toISOString(),
    });
  });

  app.post("/api/auth/verify", async (req, res) => {
    const route = req.body?.route;
    const key = req.body?.key;
    if (!staffRoutes.has(route)) {
      return res.status(400).json({
        ok: false,
        code: "INVALID_ROUTE",
        message: "Route is not a staff route.",
      });
    }

    const result = await verifyStaffKey(
      route,
      key,
      env.staffRouteToKey,
      env.authFailureDelayMs
    );
    if (!result.ok) {
      return res.status(401).json({
        ok: false,
        code: result.code,
        message: "Invalid access key.",
      });
    }

    return res.status(200).json({ ok: true });
  });

  io.use(async (socket, next) => {
    const route = socket.handshake.auth?.route;
    if (!staffRoutes.has(route)) {
      return next();
    }

    const key = socket.handshake.auth?.key;
    const result = await verifyStaffKey(
      route,
      key,
      env.staffRouteToKey,
      env.authFailureDelayMs
    );
    if (!result.ok) {
      return next(new Error("AUTH_INVALID"));
    }
    return next();
  });

  io.on("connection", (socket) => {
    const route = socket.handshake.auth?.route || "unknown";
    socket.emit("server:hello", {
      serverTime: new Date().toISOString(),
      version: "m0",
      raceDurationSeconds,
      route,
    });

    socket.on("client:hello", (payload) => {
      socket.emit("server:hello", {
        serverTime: new Date().toISOString(),
        version: "m0",
        raceDurationSeconds,
        route,
        echo: payload || null,
      });
    });
  });

  app.get("*", (req, res, next) => {
    if (
      req.path.startsWith("/api") ||
      req.path.startsWith("/socket.io") ||
      req.path === "/healthz"
    ) {
      return next();
    }

    if (spaRoutes.has(req.path) || req.path === "/") {
      return res.sendFile(path.join(staticDir, "index.html"));
    }

    return res.status(404).json({ error: "Not found" });
  });

  return { app, server, raceDurationSeconds };
}

if (require.main === module) {
  try {
    const { server, raceDurationSeconds } = createApp();
    const port = Number.parseInt(process.env.PORT || "3000", 10);
    server.listen(port, () => {
      console.log(
        `Racetrack M0 server listening on port ${port} (raceDurationSeconds=${raceDurationSeconds})`
      );
    });
  } catch (error) {
    console.error(`Startup failed: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { createApp };
