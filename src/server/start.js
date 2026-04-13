const { createApp } = require("./createApp");
const { createLogger } = require("../observability/logger");

function startServer() {
  try {
    const { server, raceDurationSeconds, logger } = createApp();
    const port = Number.parseInt(process.env.PORT || "3000", 10);
    server.listen(port, () => {
      logger.info("server.started", {
        port,
        raceDurationSeconds,
      });
      console.log(
        `Racetrack M1 server listening on port ${port} (raceDurationSeconds=${raceDurationSeconds})`
      );
    });
  } catch (error) {
    createLogger({ baseFields: { service: "racetrack" } }).error("server.start_failed", {
      error,
    });
    console.error(`Startup failed: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  startServer,
};
