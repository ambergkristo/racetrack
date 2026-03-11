const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

async function run() {
  let failures = 0;

  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`ok - ${name}`);
    } catch (error) {
      failures += 1;
      console.error(`not ok - ${name}`);
      console.error(error && error.stack ? error.stack : error);
    }
  }

  if (failures > 0) {
    process.exitCode = 1;
  }
}

module.exports = {
  run,
  test,
};
