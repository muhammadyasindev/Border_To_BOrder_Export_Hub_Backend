import { NextResponse } from "next/server";
import { getCurrentUser, signUserId, getSessionCookieOptions } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const user = await getCurrentUser();
    return NextResponse.json({ user: user || null });
  } catch (error: any) {
    console.error("Error in /api/auth/me:", error?.message || error);
    return NextResponse.json({ user: null });
  }
}

export async function POST(req: Request) {
  // In production environments, or without explicit development flag, persona switching is strictly blocked
  const isProd = process.env.NODE_ENV === "production";
  const devSwitchEnabled = process.env.ENABLE_DEV_PERSONA_SWITCH === "true";

  if (isProd || !devSwitchEnabled) {
    return NextResponse.json(
      { error: "Persona switching is disabled in this environment. Authentication requires valid credentials." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { userId, role } = body;

    const currentUser = await getCurrentUser();

    // Prevent unauthorized privilege escalation to admin via persona switch
    if (role === "admin" && (!currentUser || currentUser.role !== "admin")) {
      return NextResponse.json({ error: "Cannot escalate role to administrator" }, { status: 403 });
    }

    if (role && currentUser && ["exporter", "importer", "driver"].includes(role)) {
      await db.update(users).set({ role }).where(eq(users.id, currentUser.id));
      const [updatedUser] = await db.select().from(users).where(eq(users.id, currentUser.id)).limit(1);
      return NextResponse.json({ success: true, user: updatedUser });
    }

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const [user] = await db.select().from(users).where(eq(users.id, Number(userId))).limit(1);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const response = NextResponse.json({ success: true, user });
    const token = signUserId(user.id);
    response.cookies.set("bg_user_id", token, getSessionCookieOptions());
    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
