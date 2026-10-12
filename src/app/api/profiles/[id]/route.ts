import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, products, buyerDemands, transportOffers } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = Number(id);

  try {
    const [user] = await db.select({
      id: users.id,
      fullName: users.fullName,
      businessName: users.businessName,
      role: users.role,
      country: users.country,
      city: users.city,
      bio: users.bio,
      verificationStatus: users.verificationStatus,
      verifiedAt: users.verifiedAt,
      createdAt: users.createdAt,
    }).from(users).where(eq(users.id, userId)).limit(1);

    if (!user) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    // Role-specific public safe offerings
    let userProducts: any[] = [];
    let userDemands: any[] = [];
    let userOffers: any[] = [];

    if (user.role === "exporter") {
      userProducts = await db.select().from(products).where(eq(products.exporterId, userId)).limit(10);
    } else if (user.role === "importer") {
      userDemands = await db.select().from(buyerDemands).where(eq(buyerDemands.buyerId, userId)).limit(10);
    } else if (user.role === "driver") {
      userOffers = await db.select().from(transportOffers).where(eq(transportOffers.driverId, userId)).limit(10);
    }

    return NextResponse.json({
      user,
      products: userProducts,
      demands: userDemands,
      offers: userOffers,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
