const {
  SOCKET_EVENTS,
  socketAuthSchema,
  clientHelloSchema,
  serverHelloSchema,
  serverErrorSchema,
} = require("../../socket/contract");

function registerRaceSocketHandlers({
  io,
  env,
  logger,
  raceDurationSeconds,
  staffRoutes,
  emitCanonicalState,
  verifyStaffKey,
}) {
  io.use(async (socket, next) => {
    const authResult = socketAuthSchema.safeParse(socket.handshake.auth || {});
    if (!authResult.success) {
      logger.warn("socket.auth_invalid", {
        socketId: socket.id,
        route: socket.handshake.auth?.route || null,
        reason: "schema_validation_failed",
      });
      return next(new Error("AUTH_INVALID"));
    }

    const route = authResult.data.route;
    if (!staffRoutes.has(route)) {
      return next();
    }

    if (env.staffAuthDisabled) {
      return next();
    }

    const key = authResult.data.key;
    const result = await verifyStaffKey(
      route,
      key,
      env.staffRouteToKey,
      env.authFailureDelayMs
    );
    if (!result.ok) {
      logger.warn("socket.auth_invalid", {
        socketId: socket.id,
        route,
        reason: result.code,
      });
      return next(new Error("AUTH_INVALID"));
    }

    return next();
  });

  io.on("connection", (socket) => {
    const route = socket.handshake.auth?.route || "unknown";
    logger.info("socket.connected", {
      socketId: socket.id,
      route,
    });
    socket.emit(
      SOCKET_EVENTS.SERVER_HELLO,
      serverHelloSchema.parse({
        serverTime: new Date().toISOString(),
        version: "m1",
        raceDurationSeconds,
        route,
      })
    );
    emitCanonicalState(socket, {
      reason: "socket_connected",
      socketId: socket.id,
      route,
      includeTick: true,
    });

    socket.on(SOCKET_EVENTS.CLIENT_HELLO, (payload) => {
      try {
        const parsedClientHello = clientHelloSchema.safeParse(payload || {});
        if (!parsedClientHello.success) {
          logger.warn("socket.client_payload_invalid", {
            socketId: socket.id,
            route,
            eventName: SOCKET_EVENTS.CLIENT_HELLO,
            issues: parsedClientHello.error.issues.map((issue) => issue.message),
          });
          socket.emit(
            SOCKET_EVENTS.SERVER_ERROR,
            serverErrorSchema.parse({
              code: "INVALID_CLIENT_HELLO",
              message: "client:hello payload failed validation.",
            })
          );
          return;
        }

        socket.emit(
          SOCKET_EVENTS.SERVER_HELLO,
          serverHelloSchema.parse({
            serverTime: new Date().toISOString(),
            version: "m1",
            raceDurationSeconds,
            route,
            echo: parsedClientHello.data,
          })
        );
        emitCanonicalState(socket, {
          reason: "client_hello_resync",
          socketId: socket.id,
          route,
          includeTick: true,
        });
      } catch (error) {
        logger.error("socket.internal_error", {
          socketId: socket.id,
          route,
          eventName: SOCKET_EVENTS.CLIENT_HELLO,
          error,
        });
        socket.emit(
          SOCKET_EVENTS.SERVER_ERROR,
          serverErrorSchema.parse({
            code: "INTERNAL_SOCKET_ERROR",
            message: "Unexpected socket error.",
          })
        );
      }
    });

    socket.on("disconnect", (reason) => {
      logger.info("socket.disconnected", {
        socketId: socket.id,
        route,
        reason,
      });
    });
  });
}

module.exports = {
  registerRaceSocketHandlers,
};
