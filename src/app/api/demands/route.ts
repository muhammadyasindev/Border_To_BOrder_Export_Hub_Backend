import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { buyerDemands, users } from "@/db/schema";
import { eq, desc, ilike, and } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const destination = searchParams.get("destination") || "";
    const myOnly = searchParams.get("myOnly") === "true";

    const user = await getCurrentUser();

    let query = db.select({
      id: buyerDemands.id,
      buyerId: buyerDemands.buyerId,
      title: buyerDemands.title,
      category: buyerDemands.category,
      specifications: buyerDemands.specifications,
      quantityRequired: buyerDemands.quantityRequired,
      unit: buyerDemands.unit,
      targetPrice: buyerDemands.targetPrice,
      currency: buyerDemands.currency,
      preferredOrigin: buyerDemands.preferredOrigin,
      destinationCountry: buyerDemands.destinationCountry,
      destinationCity: buyerDemands.destinationCity,
      deliveryDeadline: buyerDemands.deliveryDeadline,
      packagingRequirements: buyerDemands.packagingRequirements,
      status: buyerDemands.status,
      createdAt: buyerDemands.createdAt,
      buyerName: users.fullName,
      businessName: users.businessName,
      buyerCountry: users.country,
      buyerVerificationStatus: users.verificationStatus,
    })
    .from(buyerDemands)
    .leftJoin(users, eq(buyerDemands.buyerId, users.id))
    .orderBy(desc(buyerDemands.createdAt));

    const conditions = [];

    if (myOnly && user) {
      conditions.push(eq(buyerDemands.buyerId, user.id));
    }
    if (destination) {
      conditions.push(eq(buyerDemands.destinationCountry, destination));
    }
    if (search) {
      conditions.push(ilike(buyerDemands.title, `%${search}%`));
    }

    const results = conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;

    return NextResponse.json({ demands: results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "importer" && user.role !== "admin") {
    return NextResponse.json({ error: "Only buyers/importers can post purchase demands" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      title,
      category,
      specifications,
      quantityRequired,
      unit,
      targetPrice,
      currency,
      preferredOrigin,
      destinationCountry,
      destinationCity,
      deliveryDeadline,
      packagingRequirements,
    } = body;

    if (!title || !category || !specifications || !quantityRequired || !destinationCountry) {
      return NextResponse.json({ error: "Please fill in all mandatory demand fields" }, { status: 400 });
    }

    const [newDemand] = await db.insert(buyerDemands).values({
      buyerId: user.id,
      title,
      category,
      specifications,
      quantityRequired: String(quantityRequired),
      unit: unit || "Metric Tons",
      targetPrice: targetPrice ? String(targetPrice) : null,
      currency: currency || "USD",
      preferredOrigin: preferredOrigin || "Any",
      destinationCountry,
      destinationCity: destinationCity || user.city || "Kandahar",
      deliveryDeadline: deliveryDeadline || "Within 30 days",
      packagingRequirements: packagingRequirements || "Standard Export Bags",
      status: "active",
    }).returning();

    return NextResponse.json({ success: true, demand: newDemand });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
