const { extractIdempotencyKey, buildRequestFingerprint } = require("../http/request");
const { toErrorResponse, sendError } = require("../http/errors");

function createMutationExecutor({ idempotencyStore, logger }) {
  return async function executeMutation(req, res, operation) {
    try {
      const response = await idempotencyStore.run({
        key: extractIdempotencyKey(req),
        fingerprint: buildRequestFingerprint(req),
        execute: async () => {
          try {
            return await operation();
          } catch (error) {
            return toErrorResponse(error, logger, req);
          }
        },
      });

      return res.status(response.status).json(response.body);
    } catch (error) {
      return sendError(res, error, logger, req);
    }
  };
}

module.exports = {
  createMutationExecutor,
};
