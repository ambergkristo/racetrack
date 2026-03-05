import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const srcDir = path.join(rootDir, "client");
const outDir = path.join(rootDir, "public");

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function run() {
  if (!(await exists(srcDir))) {
    throw new Error(`Missing client source directory: ${srcDir}`);
  }

  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });
  await fs.cp(srcDir, outDir, { recursive: true });

  console.log(`Build complete: copied ${srcDir} -> ${outDir}`);
}

run().catch((error) => {
  console.error(`Build failed: ${error.message}`);
  process.exit(1);
});
