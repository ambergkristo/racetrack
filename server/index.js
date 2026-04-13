const { createApp } = require("./src/app/createApp");
const { startServer } = require("./src/app/start");

if (require.main === module) {
  startServer();
}

module.exports = { createApp };
