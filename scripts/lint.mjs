import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const roots = ["client", "scripts", "src", "tests"];

async function gatherFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return gatherFiles(fullPath);
      }

      if (/\.(?:js|mjs)$/.test(entry.name)) {
        return [fullPath];
      }

      return [];
    })
  );

  return nested.flat();
}

async function run() {
  const discovered = await Promise.all(roots.map((root) => gatherFiles(root)));
  const files = ["server.js", ...discovered.flat()].sort();

  for (const file of files) {
    const result = spawnSync(process.execPath, ["--check", file], {
      stdio: "inherit",
    });
    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }

  console.log(`Lint check passed for ${files.length} files.`);
}

run().catch((error) => {
  console.error(`Lint failed: ${error.message}`);
  process.exit(1);
});
