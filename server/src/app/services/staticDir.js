const fs = require("node:fs");
const path = require("node:path");

function resolveStaticDir(rootDir) {
  const builtDir = path.join(rootDir, "server", "public");
  const sourceDir = path.join(rootDir, "client");
  const builtIndex = path.join(builtDir, "index.html");
  return fs.existsSync(builtIndex) ? builtDir : sourceDir;
}

module.exports = {
  resolveStaticDir,
};
