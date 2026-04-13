function serializeError(error) {
  if (!(error instanceof Error)) {
    return error;
  }

  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    code: error.code,
    status: error.status,
  };
}

function createLogger({
  now = () => new Date(),
  writeInfo = console.log,
  writeWarn = console.warn,
  writeError = console.error,
  baseFields = {},
} = {}) {
  function timestamp() {
    const value = now();
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  }

  function emit(writer, level, event, fields = {}) {
    writer(
      JSON.stringify({
        timestamp: timestamp(),
        level,
        event,
        ...baseFields,
        ...fields,
      })
    );
  }

  return {
    info(event, fields) {
      emit(writeInfo, "info", event, fields);
    },
    warn(event, fields) {
      emit(writeWarn, "warn", event, fields);
    },
    error(event, fields) {
      emit(writeError, "error", event, {
        ...fields,
        error: serializeError(fields?.error),
      });
    },
  };
}

module.exports = {
  createLogger,
};
