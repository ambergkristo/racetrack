const { DomainError } = require("../../domain/raceStore");

function parseBody(schema, req) {
  const result = schema.safeParse(req.body || {});
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new DomainError(
      "INVALID_REQUEST",
      issue?.message || "Request body failed validation.",
      400
    );
  }

  return result.data;
}

function normalizeOptionalHeaderValue(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized === "" ? null : normalized;
}

function stableSerialize(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(",")}]`;
  }

  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
    .join(",")}}`;
}

function extractIdempotencyKey(req) {
  return (
    normalizeOptionalHeaderValue(req.headers["idempotency-key"]) ||
    normalizeOptionalHeaderValue(req.headers["x-idempotency-key"]) ||
    normalizeOptionalHeaderValue(req.headers["x-request-id"]) ||
    normalizeOptionalHeaderValue(req.body?.requestId)
  );
}

function buildRequestFingerprint(req) {
  return stableSerialize({
    method: req.method,
    path: req.path,
    staffRoute: req.staffRoute || null,
    body: req.body || null,
  });
}

module.exports = {
  parseBody,
  normalizeOptionalHeaderValue,
  stableSerialize,
  extractIdempotencyKey,
  buildRequestFingerprint,
};
