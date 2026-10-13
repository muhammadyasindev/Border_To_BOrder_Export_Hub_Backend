import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error("Health check database ping failed:", error?.message || error);
    return Response.json(
      { ok: false, error: error?.message || "Health check failed" },
      { status: 500 }
    );
  }
}
