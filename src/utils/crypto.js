import crypto from "crypto";
import bcrypt from "bcryptjs";
import { env } from "../config/env.js";

const MAX_SESSION_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function getSessionSecret() {
  return env.SESSION_SECRET;
}

export function signUserId(userId, issuedAt = Date.now()) {
  const secret = getSessionSecret();
  const payload = `${userId}.${issuedAt}`;
  const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${hmac}`;
}

export function verifySignedToken(token) {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [idStr, issuedAtStr, hmac] = parts;
  const issuedAt = parseInt(issuedAtStr, 10);

  if (!idStr || isNaN(issuedAt) || issuedAt <= 0) return null;

  const now = Date.now();
  if (now - issuedAt > MAX_SESSION_AGE_MS) return null;
  if (issuedAt > now + 60000) return null; // clock skew max 60s

  const secret = getSessionSecret();
  const expectedHmac = crypto.createHmac("sha256", secret).update(`${idStr}.${issuedAt}`).digest("hex");

  const hmacBuf = Buffer.from(hmac, "utf-8");
  const expectedBuf = Buffer.from(expectedHmac, "utf-8");

  if (hmacBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(hmacBuf, expectedBuf)) return null;

  return { userId: idStr, issuedAt };
}

export async function hashPassword(plainText) {
  return bcrypt.hash(plainText, 10);
}

export async function verifyPassword(plainText, hash) {
  return bcrypt.compare(plainText, hash);
}

export function generateOtp() {
  return crypto.randomInt(100000, 999999).toString();
}

export function hashOtp(otp) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}
