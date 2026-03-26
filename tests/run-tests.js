require("./session-racer-crud.integration.test");
require("./feature-flags.integration.test");
require("./front-desk-feature-flag.ui.test");
require("./front-desk-workflow.ui.test");
require("./staff-route-ux.ui.test");
require("./race-control-clarity.ui.test");
require("./race-control-regression.integration.test");
require("./phase4-race-control-parity.ui.test");
require("./phase2-public-truth-regression.ui.test");
require("./backend-hardening.integration.test");
require("./race-store.test");
require("./race-state-machine.test");
require("./race-flow.integration.test");
require("./persistence-recovery.integration.test");
require("./realtime-contract.integration.test");
require("./resilience.integration.test");
require("./socket-smoke.test");
require("./staff-auth-bypass.integration.test");

const { run } = require("./helpers/testHarness");

run().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
