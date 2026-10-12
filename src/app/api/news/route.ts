import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { newsReports, users } from "@/db/schema";
import { eq, desc, ilike, and } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || "";
    const corridor = searchParams.get("corridor") || "";
    const audience = searchParams.get("audience") || "";

    let query = db.select({
      id: newsReports.id,
      authorId: newsReports.authorId,
      title: newsReports.title,
      category: newsReports.category,
      targetAudience: newsReports.targetAudience,
      locationCorridor: newsReports.locationCorridor,
      summary: newsReports.summary,
      details: newsReports.details,
      sourceType: newsReports.sourceType,
      sourceName: newsReports.sourceName,
      priceDetails: newsReports.priceDetails,
      waitingTimeHours: newsReports.waitingTimeHours,
      status: newsReports.status,
      createdAt: newsReports.createdAt,
      authorName: users.fullName,
      authorRole: users.role,
      authorBusiness: users.businessName,
      authorVerified: users.verificationStatus,
    })
    .from(newsReports)
    .leftJoin(users, eq(newsReports.authorId, users.id))
    .where(eq(newsReports.status, "published"))
    .orderBy(desc(newsReports.createdAt));

    const conditions = [eq(newsReports.status, "published")];

    if (category) {
      conditions.push(eq(newsReports.category, category));
    }
    if (corridor) {
      conditions.push(ilike(newsReports.locationCorridor, `%${corridor}%`));
    }
    if (audience && audience !== "all") {
      conditions.push(eq(newsReports.targetAudience, audience));
    }

    const results = await db.select({
      id: newsReports.id,
      authorId: newsReports.authorId,
      title: newsReports.title,
      category: newsReports.category,
      targetAudience: newsReports.targetAudience,
      locationCorridor: newsReports.locationCorridor,
      summary: newsReports.summary,
      details: newsReports.details,
      sourceType: newsReports.sourceType,
      sourceName: newsReports.sourceName,
      priceDetails: newsReports.priceDetails,
      waitingTimeHours: newsReports.waitingTimeHours,
      status: newsReports.status,
      createdAt: newsReports.createdAt,
      authorName: users.fullName,
      authorRole: users.role,
      authorBusiness: users.businessName,
      authorVerified: users.verificationStatus,
    })
    .from(newsReports)
    .leftJoin(users, eq(newsReports.authorId, users.id))
    .where(and(...conditions))
    .orderBy(desc(newsReports.createdAt));

    return NextResponse.json({ news: results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      title,
      category,
      targetAudience,
      locationCorridor,
      summary,
      details,
      sourceType,
      sourceName,
      priceDetails,
      waitingTimeHours,
    } = body;

    if (!title || !category || !locationCorridor || !summary) {
      return NextResponse.json({ error: "Please fill in all mandatory news report fields" }, { status: 400 });
    }

    // Official sources can only be designated by Admin; community users default to community_report or community_confirmed
    let safeSourceType = sourceType || "community_report";
    if (safeSourceType === "official_source" && user.role !== "admin") {
      safeSourceType = "community_report";
    }

    const [newReport] = await db.insert(newsReports).values({
      authorId: user.id,
      title,
      category,
      targetAudience: targetAudience || "all",
      locationCorridor,
      summary,
      details: details || summary,
      sourceType: safeSourceType,
      sourceName: sourceName || user.businessName || user.fullName,
      priceDetails: priceDetails || null,
      waitingTimeHours: waitingTimeHours ? Number(waitingTimeHours) : null,
      status: "published",
    }).returning();

    return NextResponse.json({ success: true, report: newReport });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
