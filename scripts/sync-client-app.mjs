import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const bundles = [
  {
    output: "client/app.js",
    sourceFiles: [
      "client/src/app/shell-start.part",
      "client/src/shared/constants/routeMeta.part",
      "client/src/app/state.part",
      "client/src/shared/runtime/selectors.part",
      "client/src/shared/ui/layout.part",
      "client/src/app/feature-loader.part",
      "client/src/app/routes.part",
      "client/src/app/runtime-core.part",
      "client/src/app/runtime-end.part",
    ],
  },
  {
    output: "client/feature-frontdesk.js",
    sourceFiles: [
      "client/src/features/frontDesk/components.part",
      "client/src/features/frontDesk/modal.part",
      "client/src/features/frontDesk/page.part",
      "client/src/features/frontDesk/bindings.part",
    ],
  },
  {
    output: "client/feature-race-control.js",
    sourceFiles: [
      "client/src/features/raceControl/view.part",
      "client/src/features/raceControl/bindings.part",
    ],
  },
  {
    output: "client/feature-lap-line-tracker.js",
    sourceFiles: [
      "client/src/features/lapLineTracker/view.part",
      "client/src/features/lapLineTracker/runtime.part",
    ],
  },
  {
    output: "client/feature-public.js",
    sourceFiles: [
      "client/src/features/public/leaderboard.part",
      "client/src/features/public/screens.part",
    ],
  },
  {
    output: "client/feature-home.js",
    sourceFiles: ["client/src/features/home/view.part"],
  },
];

async function readSection(relativePath) {
  return fs.readFile(path.join(rootDir, relativePath), "utf8");
}

async function main() {
  await Promise.all(
    bundles.map(async ({ output, sourceFiles }) => {
      const sections = await Promise.all(sourceFiles.map(readSection));
      const contents = [
        "// Generated from client/src. Run `npm run sync:client` after editing source modules.",
        ...sections.map((section) => section.replace(/\s+$/u, "")),
        "",
      ].join("\n");

      await fs.writeFile(path.join(rootDir, output), contents, "utf8");
    })
  );
}

main().catch((error) => {
  console.error(`Client sync failed: ${error.message}`);
  process.exit(1);
});
