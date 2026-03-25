require("./m3-flag-matrix.integration.test");

const { run } = require("./helpers/testHarness");

run().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
