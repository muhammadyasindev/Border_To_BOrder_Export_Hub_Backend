import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/db";
import { users, passwordResets } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";

// IP rate limit store: max 10 requests per 15 minutes per IP
const ipRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkIpRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = ipRateLimitMap.get(ip);
  if (!record || now > record.resetAt) {
    ipRateLimitMap.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  if (record.count >= 10) {
    return false;
  }
  record.count++;
  return true;
}

async function dispatchEmailOtp(email: string, otp: string): Promise<{ success: boolean; error?: string }> {
  const isProduction = process.env.NODE_ENV === "production";
  const apiKey = process.env.RESEND_API_KEY;

  if (isProduction && !apiKey) {
    return { success: false, error: "Production email provider not configured" };
  }

  if (apiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.FROM_EMAIL || "BorderGlow Security <no-reply@borderglow.trade>",
          to: [email],
          subject: "BorderGlow Single-Use Password Reset Code",
          text: `Your BorderGlow verification code is: ${otp}\n\nThis single-use code expires in 15 minutes. If you did not request this code, please secure your account immediately.`,
        }),
      });
      if (!res.ok) {
        return { success: false, error: "Email provider rejected message" };
      }
      return { success: true };
    } catch (e: any) {
      console.error("Email dispatch failed:", e);
      return { success: false, error: e.message || "Email dispatch failed" };
    }
  }

  // Development/test audit log only - NEVER executed in production
  if (!isProduction) {
    console.log(`[DEV AUDIT] OTP for ${email}: ${otp} (Expires in 15m)`);
  }
  return { success: true };
}

export async function POST(req: Request) {
  try {
    const isProduction = process.env.NODE_ENV === "production";

    // 1. Production safety gate: fail safely if no real email provider is configured
    if (isProduction && !process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: "Password recovery service is temporarily unavailable. Email delivery provider is not configured." },
        { status: 503 }
      );
    }

    // 2. IP-based rate limiting
    const forwarded = req.headers.get("x-forwarded-for");
    const clientIp = forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";
    if (!checkIpRateLimit(clientIp)) {
      return NextResponse.json(
        { error: "Too many password recovery requests from this IP. Please try again later." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email address is required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if account exists
    const [user] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);

    if (user) {
      // 3. Account-based rate limiting: check if a reset was requested in the last 60 seconds
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
      const [recentRequest] = await db
        .select()
        .from(passwordResets)
        .where(
          and(
            eq(passwordResets.email, normalizedEmail),
            gt(passwordResets.createdAt, oneMinuteAgo)
          )
        )
        .limit(1);

      if (!recentRequest) {
        // 4. Generate cryptographically secure 6-digit single-use OTP
        const otp = crypto.randomInt(100000, 999999).toString();
        const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes validity

        await db.insert(passwordResets).values({
          email: normalizedEmail,
          otpHash,
          attempts: 0,
          expiresAt,
        });

        await dispatchEmailOtp(normalizedEmail, otp);
      }
    }

    // Always return generic response to prevent account enumeration attacks
    return NextResponse.json({
      success: true,
      message: "If an account exists with this email address, a 6-digit verification code has been dispatched.",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to initiate password reset" }, { status: 500 });
  }
}
