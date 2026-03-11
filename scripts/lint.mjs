import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

const roots = [
  "server.js",
  "client",
  "scripts",
  "src",
  "tests",
];

function collectJavaScriptFiles(target) {
  const absoluteTarget = path.resolve(target);
  const stats = statSync(absoluteTarget);
  if (stats.isFile()) {
    return absoluteTarget.endsWith(".js") || absoluteTarget.endsWith(".mjs")
      ? [absoluteTarget]
      : [];
  }

  return readdirSync(absoluteTarget, { withFileTypes: true }).flatMap((entry) => {
    const resolved = path.join(absoluteTarget, entry.name);
    if (entry.isDirectory()) {
      return collectJavaScriptFiles(resolved);
    }

    return resolved.endsWith(".js") || resolved.endsWith(".mjs") ? [resolved] : [];
  });
}

const files = roots.flatMap((root) => collectJavaScriptFiles(root));

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("Lint check passed.");
