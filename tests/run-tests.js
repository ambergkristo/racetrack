require("./session-racer-crud.integration.test");
require("./backend-hardening.integration.test");
require("./race-store.test");
require("./race-state-machine.test");
require("./race-flow.integration.test");
require("./realtime-contract.integration.test");
require("./resilience.integration.test");
require("./socket-smoke.test");

const { run } = require("./helpers/testHarness");

run().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
