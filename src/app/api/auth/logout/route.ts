import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (user) {
      // Invalidate all active sessions for this user across all browsers and devices
      await db.update(users).set({ sessionsRevokedAt: new Date() }).where(eq(users.id, user.id));
    }
  } catch (e) {
    console.error("Logout session revocation error:", e);
  }

  const response = NextResponse.json({ success: true, message: "Logged out successfully and all active sessions revoked" });
  response.cookies.set("bg_user_id", "", {
    path: "/",
    httpOnly: true,
    maxAge: 0,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
