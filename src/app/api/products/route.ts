import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { products, users } from "@/db/schema";
import { eq, desc, ilike, and } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const origin = searchParams.get("origin") || "";
    const myOnly = searchParams.get("myOnly") === "true";

    const user = await getCurrentUser();

    let query = db.select({
      id: products.id,
      exporterId: products.exporterId,
      title: products.title,
      category: products.category,
      description: products.description,
      qualityGrade: products.qualityGrade,
      quantityAvailable: products.quantityAvailable,
      unit: products.unit,
      pricePerUnit: products.pricePerUnit,
      currency: products.currency,
      originCountry: products.originCountry,
      originCity: products.originCity,
      destinationMarkets: products.destinationMarkets,
      imageUrl: products.imageUrl,
      status: products.status,
      createdAt: products.createdAt,
      exporterName: users.fullName,
      businessName: users.businessName,
      exporterCountry: users.country,
      exporterVerificationStatus: users.verificationStatus,
    })
    .from(products)
    .leftJoin(users, eq(products.exporterId, users.id))
    .orderBy(desc(products.createdAt));

    const conditions = [];

    if (myOnly && user) {
      conditions.push(eq(products.exporterId, user.id));
    }
    if (category) {
      conditions.push(eq(products.category, category));
    }
    if (origin) {
      conditions.push(eq(products.originCountry, origin));
    }
    if (search) {
      conditions.push(ilike(products.title, `%${search}%`));
    }

    const results = conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;

    return NextResponse.json({ products: results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "exporter" && user.role !== "admin") {
    return NextResponse.json({ error: "Only exporters can publish products" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      title,
      category,
      description,
      qualityGrade,
      quantityAvailable,
      unit,
      pricePerUnit,
      currency,
      originCountry,
      originCity,
      destinationMarkets,
      imageUrl,
    } = body;

    if (!title || !category || !description || !quantityAvailable || !pricePerUnit) {
      return NextResponse.json({ error: "Please fill in all mandatory product fields" }, { status: 400 });
    }

    const [newProduct] = await db.insert(products).values({
      exporterId: user.id,
      title,
      category,
      description,
      qualityGrade: qualityGrade || "Grade A",
      quantityAvailable: String(quantityAvailable),
      unit: unit || "Metric Tons",
      pricePerUnit: String(pricePerUnit),
      currency: currency || "USD",
      originCountry: originCountry || user.country || "Pakistan",
      originCity: originCity || user.city || "Quetta",
      destinationMarkets: destinationMarkets || "Iran, Afghanistan",
      imageUrl: imageUrl || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80",
      status: "active",
    }).returning();

    return NextResponse.json({ success: true, product: newProduct });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
