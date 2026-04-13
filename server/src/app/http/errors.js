const { DomainError } = require("../../domain/raceStore");

function toErrorResponse(error, logger, req) {
  if (error instanceof DomainError) {
    logger.warn("http.domain_error", {
      method: req.method,
      path: req.path,
      code: error.code,
      status: error.status,
      message: error.message,
    });
    return {
      status: error.status,
      body: {
        ok: false,
        code: error.code,
        message: error.message,
      },
    };
  }

  throw error;
}

function sendError(res, error, logger, req) {
  if (error instanceof DomainError) {
    logger.warn("http.domain_error", {
      method: req.method,
      path: req.path,
      code: error.code,
      status: error.status,
      message: error.message,
    });
    return res.status(error.status).json({
      ok: false,
      code: error.code,
      message: error.message,
    });
  }

  logger.error("http.internal_error", {
    method: req.method,
    path: req.path,
    error,
  });
  return res.status(500).json({
    ok: false,
    code: "INTERNAL_ERROR",
    message: "Internal server error.",
  });
}

module.exports = {
  toErrorResponse,
  sendError,
};
