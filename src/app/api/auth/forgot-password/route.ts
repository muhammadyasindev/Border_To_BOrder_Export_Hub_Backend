import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/db";
import { users, passwordResets } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { sendEmail } from "@/lib/email";

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

export async function POST(req: Request) {
  try {
    // 1. IP rate limiting
    const forwarded = req.headers.get("x-forwarded-for");
    const clientIp = forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";
    if (!checkIpRateLimit(clientIp)) {
      return NextResponse.json(
        { error: "Too many password reset requests. Please wait a few minutes." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { email } = body;

    // 2. Strict input validation
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "A valid email address is required" }, { status: 400 });
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

        const emailResult = await sendEmail({
          to: normalizedEmail,
          subject: "BorderGlow Single-Use Password Reset Code",
          text: `Your BorderGlow verification code is: ${otp}\n\nThis single-use code expires in 15 minutes. If you did not request this code, please secure your account immediately.`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
              <h2 style="color: #0f172a; margin-bottom: 8px;">BorderGlow Password Recovery</h2>
              <p style="color: #475569; font-size: 14px;">Use the following single-use verification code to reset your account password:</p>
              <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; text-align: center; margin: 20px 0;">
                <span style="font-size: 28px; font-weight: bold; letter-spacing: 6px; font-family: monospace; color: #2563eb;">${otp}</span>
              </div>
              <p style="color: #64748b; font-size: 12px;">This single-use code expires in 15 minutes. If you did not request this, please disregard this email.</p>
            </div>
          `,
        });

        if (!emailResult.success) {
          console.error("Forgot-password email delivery failed:", emailResult.error);
          return NextResponse.json(
            { error: "Unable to dispatch verification code at this time. Please check mail server settings." },
            { status: 503 }
          );
        }
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
