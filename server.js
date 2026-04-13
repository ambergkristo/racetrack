const { createApp } = require("./src/server/createApp");
const { startServer } = require("./src/server/start");

if (require.main === module) {
  startServer();
}

module.exports = { createApp };
