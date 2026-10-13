export function errorHandler(err, req, res, next) {
  console.error(`[SERVER ERROR] ${req.method} ${req.url}:`, err);

  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || "Internal server error";

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV !== "production" ? { stack: err.stack } : {}),
  });
}

export default errorHandler;
