export function ok(res, statusCode, data, message = "OK") {
  return res.status(statusCode).json({
    ok: true,
    message,
    data,
  });
}

export function fail(res, statusCode, code, message) {
  return res.status(statusCode).json({
    ok: false,
    error: {
      code,
      message,
    },
  });
}
