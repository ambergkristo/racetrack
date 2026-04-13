const path = require("node:path");

function registerSpaRoutes({ app, spaRoutes, staticDir }) {
  app.get("*", (req, res, next) => {
    if (
      req.path.startsWith("/api") ||
      req.path.startsWith("/socket.io") ||
      req.path === "/healthz"
    ) {
      return next();
    }

    if (spaRoutes.has(req.path) || req.path === "/") {
      return res.sendFile(path.join(staticDir, "index.html"));
    }

    return res.status(404).json({ error: "Not found" });
  });
}

module.exports = {
  registerSpaRoutes,
};
