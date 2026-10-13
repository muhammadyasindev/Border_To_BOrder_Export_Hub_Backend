import { verifySignedToken } from "../utils/crypto.js";
import User from "../models/User.js";

export async function extractUser(req) {
  let token = req.cookies && req.cookies.bg_user_id;

  if (!token && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    token = req.headers.authorization.slice(7).trim();
  }

  if (!token) return null;

  const verified = verifySignedToken(token);
  if (!verified || !verified.userId) return null;

  try {
    const user = await User.findById(verified.userId).select("-passwordHash");
    if (!user) return null;

    if (user.sessionsRevokedAt && verified.issuedAt < new Date(user.sessionsRevokedAt).getTime()) {
      return null;
    }

    return user;
  } catch (err) {
    return null;
  }
}

export async function optionalAuth(req, res, next) {
  try {
    req.user = await extractUser(req);
    next();
  } catch (err) {
    req.user = null;
    next();
  }
}

export async function requireAuth(req, res, next) {
  const user = await extractUser(req);
  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  req.user = user;
  next();
}

export function requireRole(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden: insufficient permissions" });
    }
    next();
  };
}
