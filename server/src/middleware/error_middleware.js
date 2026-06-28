export function notFoundHandler(req, res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

export function errorHandler(error, _req, res, _next) {
  const statusCode = error.statusCode || 500;

  res.status(statusCode).json({
    ok: false,
    error: {
      code: statusCode >= 500 ? "SERVER_ERROR" : "REQUEST_ERROR",
      message: error.message || "Server error",
    },
  });
}
