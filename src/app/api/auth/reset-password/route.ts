import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users, passwordResets } from "@/db/schema";
import { eq, and, isNull, gt, desc, sql } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, otp, newPassword } = body;

    if (!email || !otp || !newPassword) {
      return NextResponse.json({ error: "Email, 6-digit verification code, and new password are required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (newPassword.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters long" }, { status: 400 });
    }

    // Fetch latest active reset token for this email
    const [tokenRecord] = await db
      .select()
      .from(passwordResets)
      .where(
        and(
          eq(passwordResets.email, normalizedEmail),
          isNull(passwordResets.usedAt),
          gt(passwordResets.expiresAt, new Date())
        )
      )
      .orderBy(desc(passwordResets.createdAt))
      .limit(1);

    if (!tokenRecord) {
      return NextResponse.json({ error: "Invalid, expired, or previously used verification code. Please request a new one." }, { status: 400 });
    }

    // Check brute-force attempt limits (max 5 tries)
    if (tokenRecord.attempts >= 5) {
      return NextResponse.json({ error: "Too many failed attempts. This verification code has been locked for security. Please request a new code." }, { status: 429 });
    }

    // Calculate hash of candidate OTP and compare safely
    const candidateHash = crypto.createHash("sha256").update(otp.trim()).digest("hex");
    const isMatch = crypto.timingSafeEqual(
      Buffer.from(candidateHash, "utf-8"),
      Buffer.from(tokenRecord.otpHash, "utf-8")
    );

    if (!isMatch) {
      // Atomic increment in database
      const [updatedRecord] = await db
        .update(passwordResets)
        .set({ attempts: sql`${passwordResets.attempts} + 1` })
        .where(eq(passwordResets.id, tokenRecord.id))
        .returning({ attempts: passwordResets.attempts });

      const currentAttempts = updatedRecord?.attempts ?? (tokenRecord.attempts + 1);
      const remaining = Math.max(0, 5 - currentAttempts);
      return NextResponse.json({
        error: `Incorrect verification code. ${remaining} attempt(s) remaining.`,
      }, { status: 400 });
    }

    // Valid OTP: Atomic single-use invalidation under concurrent requests
    const invalidated = await db
      .update(passwordResets)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(passwordResets.id, tokenRecord.id),
          isNull(passwordResets.usedAt)
        )
      )
      .returning({ id: passwordResets.id });

    if (!invalidated || invalidated.length === 0) {
      return NextResponse.json({ error: "This verification code has already been used." }, { status: 400 });
    }

    // Valid OTP: hash new password, update user, and revoke ALL active sessions across browsers/devices
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);
    const now = new Date();

    await db.update(users).set({
      passwordHash,
      updatedAt: now,
      sessionsRevokedAt: now,
    }).where(eq(users.email, normalizedEmail));

    const response = NextResponse.json({
      success: true,
      message: "Your password has been successfully reset. You may now sign in with your new credentials.",
    });

    // Invalidate existing session on current browser
    response.cookies.set("bg_user_id", "", {
      path: "/",
      httpOnly: true,
      maxAge: 0,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to reset password" }, { status: 500 });
  }
}
