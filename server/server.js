const { createApp } = require("./index");
const { startServer } = require("./src/app/start");

if (require.main === module) {
  startServer();
}

module.exports = { createApp };
