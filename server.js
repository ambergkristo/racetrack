const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const { Server } = require("socket.io");
const {
  SOCKET_EVENTS,
  socketAuthSchema,
  clientHelloSchema,
  serverHelloSchema,
  serverErrorSchema,
} = require("./src/socket/contract");

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

const PUBLIC_ROUTES = new Set([
  "/leader-board",
  "/next-race",
  "/race-countdown",
  "/race-flags",
]);

const STAFF_ROUTES = new Set(Object.keys(STAFF_ROUTE_TO_KEY));
const SPA_ROUTES = new Set(["/", ...PUBLIC_ROUTES, ...STAFF_ROUTES]);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRaceDurationSeconds() {
  const explicit = Number.parseInt(process.env.RACE_DURATION_SECONDS || "", 10);
  if (Number.isFinite(explicit) && explicit > 0) {
    return explicit;
  }
  return process.env.NODE_ENV === "production" ? 600 : 60;
}

async function verifyStaffKey(route, key) {
  const envKeyName = STAFF_ROUTE_TO_KEY[route];
  if (!envKeyName) {
    return { ok: false, code: "UNKNOWN_STAFF_ROUTE" };
  }

  const expected = process.env[envKeyName];
  if (key && expected && key === expected) {
    return { ok: true };
  }

  await delay(500);
  return { ok: false, code: "INVALID_KEY" };
}

function assertRequiredEnv() {
  const missing = REQUIRED_KEYS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
}

function resolveStaticDir() {
  const builtDir = path.join(__dirname, "public");
  const sourceDir = path.join(__dirname, "client");
  const builtIndex = path.join(builtDir, "index.html");
  return fs.existsSync(builtIndex) ? builtDir : sourceDir;
}

function createApp() {
  assertRequiredEnv();

  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: true, credentials: true },
    transports: ["websocket"],
  });
  const raceDurationSeconds = parseRaceDurationSeconds();
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
    if (!STAFF_ROUTES.has(route)) {
      return res.status(400).json({
        ok: false,
        code: "INVALID_ROUTE",
        message: "Route is not a staff route.",
      });
    }

    const result = await verifyStaffKey(route, key);
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
    const authResult = socketAuthSchema.safeParse(socket.handshake.auth || {});
    if (!authResult.success) {
      return next(new Error("AUTH_INVALID"));
    }

    const route = authResult.data.route;
    if (!STAFF_ROUTES.has(route)) {
      return next();
    }

    const key = authResult.data.key;
    const result = await verifyStaffKey(route, key);
    if (!result.ok) {
      return next(new Error("AUTH_INVALID"));
    }
    return next();
  });

  io.on("connection", (socket) => {
    const route = socket.handshake.auth?.route || "unknown";
    const helloPayload = {
      serverTime: new Date().toISOString(),
      version: "m0",
      raceDurationSeconds,
      route,
    };
    const parsedHello = serverHelloSchema.parse(helloPayload);
    socket.emit(SOCKET_EVENTS.SERVER_HELLO, parsedHello);

    socket.on(SOCKET_EVENTS.CLIENT_HELLO, (payload) => {
      const parsedClientHello = clientHelloSchema.safeParse(payload || {});
      if (!parsedClientHello.success) {
        const errorPayload = serverErrorSchema.parse({
          code: "INVALID_CLIENT_HELLO",
          message: "client:hello payload failed validation.",
        });
        socket.emit(SOCKET_EVENTS.SERVER_ERROR, errorPayload);
        return;
      }

      const responsePayload = serverHelloSchema.parse({
        serverTime: new Date().toISOString(),
        version: "m0",
        raceDurationSeconds,
        route,
        echo: parsedClientHello.data,
      });
      socket.emit(SOCKET_EVENTS.SERVER_HELLO, responsePayload);
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

    if (SPA_ROUTES.has(req.path) || req.path === "/") {
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
