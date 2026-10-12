import { NextResponse } from "next/server";
import { seedDatabase } from "@/db/seed";

export async function GET() {
  // In production, arbitrary seeding triggers are disabled unless explicitly permitted
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_SEED !== "true") {
    return NextResponse.json(
      { error: "Database seeding endpoint is disabled in production environments for data protection." },
      { status: 403 }
    );
  }

  try {
    await seedDatabase();
    return NextResponse.json({ status: "ok", message: "Database seeded or already populated" });
  } catch (error: any) {
    console.error("Seeding error:", error);
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  }
}
