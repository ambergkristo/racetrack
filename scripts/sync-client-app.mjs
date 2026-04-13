import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const sourceFiles = [
  "client/src/app/shell-start.part",
  "client/src/shared/constants/routeMeta.part",
  "client/src/app/state.part",
  "client/src/shared/runtime/selectors.part",
  "client/src/shared/ui/layout.part",
  "client/src/features/frontDesk/view.part",
  "client/src/features/public/leaderboard.part",
  "client/src/features/lapLineTracker/view.part",
  "client/src/features/raceControl/view.part",
  "client/src/features/public/screens.part",
  "client/src/features/home/view.part",
  "client/src/app/runtime-core.part",
  "client/src/features/frontDesk/bindings.part",
  "client/src/features/raceControl/bindings.part",
  "client/src/features/lapLineTracker/runtime.part",
  "client/src/app/runtime-end.part",
];

async function readSection(relativePath) {
  return fs.readFile(path.join(rootDir, relativePath), "utf8");
}

async function main() {
  const sections = await Promise.all(sourceFiles.map(readSection));
  const output = [
    "// Generated from client/src. Run `npm run sync:client` after editing source modules.",
    ...sections.map((section) => section.replace(/\s+$/u, "")),
    "",
  ].join("\n");

  await fs.writeFile(path.join(rootDir, "client", "app.js"), output, "utf8");
}

main().catch((error) => {
  console.error(`Client sync failed: ${error.message}`);
  process.exit(1);
});
