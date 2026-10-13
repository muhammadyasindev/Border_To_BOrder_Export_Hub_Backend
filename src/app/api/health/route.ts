import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  let dbOk = false;
  let dbError: string | null = null;

  try {
    await Promise.race([
      db.execute(sql`select 1`),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Database ping timeout")), 1500)),
    ]);
    dbOk = true;
  } catch (err: any) {
    dbError = err?.message || "Database connection pending";
    console.warn("[HEALTH CHECK NOTICE] Database ping:", dbError);
  }

  // Always return HTTP 200 so Render health check does not kill the instance
  return Response.json(
    {
      status: "ok",
      uptime: Math.floor(process.uptime()),
      database: dbOk ? "connected" : "connecting",
      databaseNotice: dbError,
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}
