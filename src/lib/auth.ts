import { cookies } from "next/headers";
import crypto from "crypto";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

const MAX_SESSION_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

/**
 * Validates and retrieves the HMAC signing secret.
 * In production, a strong, custom secret of at least 32 characters is strictly required.
 */
export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    if (!secret || secret.length < 32 || secret.includes("borderglow_hmac_secret_key_prod") || secret.includes("default")) {
      throw new Error(
        "CRITICAL SECURITY CONFIGURATION ERROR: A strong SESSION_SECRET (minimum 32 characters, non-default) is mandatory in production environment."
      );
    }
    return secret;
  }

  return secret || "borderglow_dev_hmac_secret_key_minimum_32_characters_for_security";
}

export interface SessionUser {
  id: number;
  email: string;
  fullName: string;
  businessName: string | null;
  role: string;
  country: string;
  city: string;
  phone: string | null;
  bio: string | null;
  cnicNumber?: string | null;
  personAddress?: string | null;
  businessAddress?: string | null;
  avatarUrl?: string | null;
  drivingLicenseNumber?: string | null;
  plateNumber?: string | null;
  verificationStatus: string;
  verificationNotes: string | null;
  sessionsRevokedAt?: Date | null;
}

/**
 * Creates a cryptographically signed session token: {userId}.{issuedAt}.{hmac}
 */
export function signUserId(userId: number, issuedAt: number = Date.now()): string {
  const secret = getSessionSecret();
  const payload = `${userId}.${issuedAt}`;
  const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${hmac}`;
}

/**
 * Verifies a signed session token:
 * - Rejects malformed structures (must have exactly 3 dot-delimited parts)
 * - Rejects non-numeric user IDs or timestamps
 * - Enforces defined expiration (7 days)
 * - Rejects tokens with timestamps in the future (> 60s clock skew)
 * - Performs constant-time timing-safe HMAC verification
 */
export function verifySignedToken(token: string): { userId: number; issuedAt: number } | null {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [idStr, issuedAtStr, hmac] = parts;
  const userId = parseInt(idStr, 10);
  const issuedAt = parseInt(issuedAtStr, 10);

  if (isNaN(userId) || userId <= 0 || isNaN(issuedAt) || issuedAt <= 0) {
    return null;
  }

  const now = Date.now();

  // Enforce defined expiration policy: 7 days max age
  if (now - issuedAt > MAX_SESSION_AGE_MS) {
    return null;
  }

  // Reject future-dated tokens allowing max 60s tolerance for clock drift
  if (issuedAt > now + 60_000) {
    return null;
  }

  const secret = getSessionSecret();
  const expectedHmac = crypto.createHmac("sha256", secret).update(`${userId}.${issuedAt}`).digest("hex");

  const hmacBuf = Buffer.from(hmac, "utf-8");
  const expectedBuf = Buffer.from(expectedHmac, "utf-8");

  if (hmacBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(hmacBuf, expectedBuf)) return null;

  return { userId, issuedAt };
}

export function verifySignedUserId(token: string): number | null {
  const verified = verifySignedToken(token);
  return verified ? verified.userId : null;
}

export function getSessionCookieOptions() {
  const sameSiteConfig = (process.env.COOKIE_SAME_SITE as "lax" | "none" | "strict") || "lax";
  const isSecure = process.env.NODE_ENV === "production" || sameSiteConfig === "none";

  const options: {
    path: string;
    httpOnly: boolean;
    maxAge: number;
    sameSite: "lax" | "none" | "strict";
    secure: boolean;
    domain?: string;
  } = {
    path: "/",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
    sameSite: sameSiteConfig,
    secure: isSecure,
  };

  if (process.env.COOKIE_DOMAIN) {
    options.domain = process.env.COOKIE_DOMAIN;
  }

  return options;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const userIdCookie = cookieStore.get("bg_user_id");

    if (!userIdCookie || !userIdCookie.value) {
      return null;
    }

    const sessionData = verifySignedToken(userIdCookie.value);
    if (!sessionData) {
      return null;
    }

    const [user] = await db.select().from(users).where(eq(users.id, sessionData.userId)).limit(1);
    if (!user) return null;

    // Cross-browser/device revocation check:
    // If sessionsRevokedAt is set and token was issued prior to revocation timestamp, reject!
    if (user.sessionsRevokedAt) {
      const revokedTime = new Date(user.sessionsRevokedAt).getTime();
      // Allow 1 second tolerance for timestamp resolution
      if (sessionData.issuedAt <= revokedTime) {
        return null;
      }
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      businessName: user.businessName,
      role: user.role,
      country: user.country,
      city: user.city,
      phone: user.phone,
      bio: user.bio,
      cnicNumber: user.cnicNumber,
      personAddress: user.personAddress,
      businessAddress: user.businessAddress,
      avatarUrl: user.avatarUrl,
      drivingLicenseNumber: user.drivingLicenseNumber,
      plateNumber: user.plateNumber,
      verificationStatus: user.verificationStatus,
      verificationNotes: user.verificationNotes,
      sessionsRevokedAt: user.sessionsRevokedAt,
    };
  } catch (e) {
    console.error("Error getting session user:", e);
    return null;
  }
}
