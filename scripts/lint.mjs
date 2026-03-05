import { spawnSync } from "node:child_process";

const files = [
  "server.js",
  "client/app.js",
  "scripts/build.mjs",
  "scripts/lint.mjs",
  "src/socket/contract.js",
  "tests/socket-smoke.test.js",
];

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("Lint check passed.");
