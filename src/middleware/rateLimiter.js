const ipRateLimitMap = new Map();

export function ipRateLimiter(maxRequests = 10, windowMs = 15 * 60 * 1000) {
  return (req, res, next) => {
    const forwarded = req.headers["x-forwarded-for"];
    const ip = forwarded ? forwarded.split(",")[0].trim() : req.socket.remoteAddress || "127.0.0.1";

    const now = Date.now();
    const record = ipRateLimitMap.get(ip);

    if (!record || now > record.resetAt) {
      ipRateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (record.count >= maxRequests) {
      return res.status(429).json({
        error: "Too many requests. Please wait a few minutes before trying again.",
      });
    }

    record.count++;
    next();
  };
}
