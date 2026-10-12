import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const roleFilter = searchParams.get("role");

  try {
    let query = db.select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      businessName: users.businessName,
      role: users.role,
      country: users.country,
      city: users.city,
      verificationStatus: users.verificationStatus,
    }).from(users);

    let userList = roleFilter
      ? await query.where(eq(users.role, roleFilter))
      : await query;

    // Redact private email addresses unless the requester is an authorized administrator
    if (currentUser.role !== "admin") {
      userList = userList.map((u: any) => {
        const { email, ...safe } = u;
        return safe;
      });
    }

    return NextResponse.json({ users: userList });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
