function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractStaffCredentials(req) {
  const routeHeader = req.headers["x-staff-route"];
  const keyHeader = req.headers["x-staff-key"];

  return {
    route: typeof routeHeader === "string" ? routeHeader : req.body?.staffRoute,
    key: typeof keyHeader === "string" ? keyHeader : req.body?.staffKey,
  };
}

async function verifyStaffKey(route, key, staffRouteToKey, authFailureDelayMs) {
  const envKeyName = staffRouteToKey[route];
  if (!envKeyName) {
    return { ok: false, code: "UNKNOWN_STAFF_ROUTE" };
  }

  const expected = process.env[envKeyName];
  if (key && expected && key === expected) {
    return { ok: true };
  }

  await delay(authFailureDelayMs);
  return { ok: false, code: "INVALID_KEY" };
}

function createStaffAuthMiddleware({ allowedRoutes, env, logger }) {
  return async (req, res, next) => {
    const { route, key } = extractStaffCredentials(req);
    if (!route) {
      logger.warn("http.staff_auth_failed", {
        method: req.method,
        path: req.path,
        route: route || null,
        reason: "STAFF_AUTH_REQUIRED",
      });
      return res.status(401).json({
        ok: false,
        code: "STAFF_AUTH_REQUIRED",
        message: "Staff route and key are required for this action.",
      });
    }

    if (!allowedRoutes.includes(route)) {
      logger.warn("http.staff_auth_failed", {
        method: req.method,
        path: req.path,
        route,
        reason: "STAFF_ROUTE_FORBIDDEN",
      });
      return res.status(403).json({
        ok: false,
        code: "STAFF_ROUTE_FORBIDDEN",
        message: "This staff route cannot perform the requested action.",
      });
    }

    if (env.staffAuthDisabled) {
      req.staffRoute = route;
      return next();
    }

    if (!key) {
      logger.warn("http.staff_auth_failed", {
        method: req.method,
        path: req.path,
        route,
        reason: "STAFF_AUTH_REQUIRED",
      });
      return res.status(401).json({
        ok: false,
        code: "STAFF_AUTH_REQUIRED",
        message: "Staff route and key are required for this action.",
      });
    }

    const result = await verifyStaffKey(
      route,
      key,
      env.staffRouteToKey,
      env.authFailureDelayMs
    );
    if (!result.ok) {
      logger.warn("http.staff_auth_failed", {
        method: req.method,
        path: req.path,
        route,
        reason: result.code,
      });
      return res.status(401).json({
        ok: false,
        code: result.code,
        message: "Invalid access key.",
      });
    }

    req.staffRoute = route;
    return next();
  };
}

module.exports = {
  extractStaffCredentials,
  verifyStaffKey,
  createStaffAuthMiddleware,
};
