const fs = require("node:fs");
const path = require("node:path");

const bundleCache = new Map();

function resolvePathname(input) {
  if (typeof input === "string") {
    return new URL(input, "http://localhost").pathname;
  }

  if (input && typeof input.url === "string") {
    return new URL(input.url, "http://localhost").pathname;
  }

  return String(input || "");
}

function readFeatureBundle(bundlePath) {
  if (!bundleCache.has(bundlePath)) {
    const filePath = path.join(__dirname, "..", "..", "client", bundlePath.replace(/^\//, ""));
    bundleCache.set(bundlePath, fs.readFileSync(filePath, "utf8"));
  }

  return bundleCache.get(bundlePath);
}

function createResponse({ ok, status, jsonData, textData }) {
  return {
    ok,
    status,
    async json() {
      if (typeof jsonData === "undefined") {
        throw new Error(`No JSON payload configured for status ${status}.`);
      }

      return jsonData;
    },
    async text() {
      return typeof textData === "string" ? textData : "";
    },
  };
}

function createClientAppFetch({ bootstrap }) {
  return async function fetch(input) {
    const pathname = resolvePathname(input);

    if (pathname === "/api/bootstrap") {
      return createResponse({
        ok: true,
        status: 200,
        jsonData: bootstrap,
        textData: JSON.stringify(bootstrap),
      });
    }

    if (/^\/feature-[^/]+\.js$/.test(pathname)) {
      return createResponse({
        ok: true,
        status: 200,
        textData: readFeatureBundle(pathname),
      });
    }

    return createResponse({
      ok: false,
      status: 404,
      textData: "Not Found",
    });
  };
}

module.exports = {
  createClientAppFetch,
};
