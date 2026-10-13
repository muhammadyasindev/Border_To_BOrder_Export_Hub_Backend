import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/db";
import { users, emailVerifications } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendEmail } from "@/lib/email";

// IP rate limit: max 10 OTP requests per 15 min per IP
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
        { error: "Too many requests. Please wait a few minutes before requesting another verification code." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { email } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "A valid email address is required" }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();

    // 2. Strict Check: is email already registered?
    const [existing] = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);
    if (existing) {
      return NextResponse.json(
        { error: "This email address is already registered. Please sign in or use another email." },
        { status: 409 }
      );
    }

    // 3. Generate 6-digit cryptographic OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // 4. Store pending OTP in database
    await db.insert(emailVerifications).values({
      email: cleanEmail,
      otpHash,
      attempts: 0,
      expiresAt,
    });

    // 5. Send OTP directly to the entered email address (never shown on screen)
    const emailResult = await sendEmail({
      to: cleanEmail,
      subject: "BorderGlow Registration Verification Code",
      text: `Your BorderGlow registration verification code is: ${otp}\n\nThis single-use code expires in 15 minutes. Enter this code to verify your trade account and complete registration.\n\nIf you did not request this, please disregard this email.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; rounded: 12px; background: #ffffff;">
          <h2 style="color: #0f172a; margin-bottom: 8px;">BorderGlow Email Verification</h2>
          <p style="color: #475569; font-size: 14px;">Enter the following single-use verification code to activate your trade account:</p>
          <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <span style="font-size: 28px; font-weight: bold; letter-spacing: 6px; font-family: monospace; color: #0284c7;">${otp}</span>
          </div>
          <p style="color: #64748b; font-size: 12px;">This code expires in 15 minutes. Never share this code with anyone.</p>
        </div>
      `,
    });

    if (!emailResult.success) {
      return NextResponse.json(
        {
          error:
            emailResult.error ||
            "Unable to deliver verification code to your email. Please check server email settings.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `A 6-digit verification code has been dispatched to ${cleanEmail}. Please check your inbox.`,
    });
  } catch (error: any) {
    console.error("send-otp error:", error);
    return NextResponse.json({ error: error.message || "Failed to dispatch verification code" }, { status: 500 });
  }
}
