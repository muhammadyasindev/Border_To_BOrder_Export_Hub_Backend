import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { signUserId, getSessionCookieOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const identifier = (email || "").trim();
    let [user] = await db.select().from(users).where(eq(users.email, identifier.toLowerCase())).limit(1);
    if (!user) {
      [user] = await db.select().from(users).where(eq(users.fullName, identifier)).limit(1);
    }
    if (!user) {
      return NextResponse.json({ error: "Invalid email/username or password" }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        businessName: user.businessName,
        role: user.role,
        verificationStatus: user.verificationStatus,
      },
    });

    const token = signUserId(user.id);
    response.cookies.set("bg_user_id", token, getSessionCookieOptions());

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Login failed" }, { status: 500 });
  }
}
