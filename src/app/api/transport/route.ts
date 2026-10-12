import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { transportOffers, vehicles, users } from "@/db/schema";
import { eq, desc, ilike, and } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const corridor = searchParams.get("corridor") || "";
    const myOnly = searchParams.get("myOnly") === "true";

    const user = await getCurrentUser();

    let query = db.select({
      id: transportOffers.id,
      driverId: transportOffers.driverId,
      vehicleId: transportOffers.vehicleId,
      title: transportOffers.title,
      originCorridor: transportOffers.originCorridor,
      destinationCorridor: transportOffers.destinationCorridor,
      availableCapacityTons: transportOffers.availableCapacityTons,
      cargoCategory: transportOffers.cargoCategory,
      ratePerKmOrTrip: transportOffers.ratePerKmOrTrip,
      pricingUnit: transportOffers.pricingUnit,
      currency: transportOffers.currency,
      availableFrom: transportOffers.availableFrom,
      status: transportOffers.status,
      specialConditions: transportOffers.specialConditions,
      createdAt: transportOffers.createdAt,
      driverName: users.fullName,
      businessName: users.businessName,
      driverCountry: users.country,
      driverCity: users.city,
      driverVerificationStatus: users.verificationStatus,
      vehicleType: vehicles.vehicleType,
      vehicleMakeModel: vehicles.makeModel,
      plateNumberMasked: vehicles.plateNumberMasked,
    })
    .from(transportOffers)
    .leftJoin(users, eq(transportOffers.driverId, users.id))
    .leftJoin(vehicles, eq(transportOffers.vehicleId, vehicles.id))
    .orderBy(desc(transportOffers.createdAt));

    const conditions = [];

    if (myOnly && user) {
      conditions.push(eq(transportOffers.driverId, user.id));
    }
    if (corridor) {
      conditions.push(ilike(transportOffers.originCorridor, `%${corridor}%`));
    }
    if (search) {
      conditions.push(ilike(transportOffers.title, `%${search}%`));
    }

    const results = conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;

    return NextResponse.json({ offers: results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "driver" && user.role !== "admin") {
    return NextResponse.json({ error: "Only drivers/transporters can publish transport offers" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      vehicleId,
      title,
      originCorridor,
      destinationCorridor,
      availableCapacityTons,
      cargoCategory,
      ratePerKmOrTrip,
      pricingUnit,
      currency,
      availableFrom,
      specialConditions,
    } = body;

    if (!title || !originCorridor || !destinationCorridor || !availableCapacityTons || !ratePerKmOrTrip) {
      return NextResponse.json({ error: "Please fill in all mandatory offer fields" }, { status: 400 });
    }

    const [newOffer] = await db.insert(transportOffers).values({
      driverId: user.id,
      vehicleId: vehicleId ? Number(vehicleId) : null,
      title,
      originCorridor,
      destinationCorridor,
      availableCapacityTons: String(availableCapacityTons),
      cargoCategory: cargoCategory || "General Freight",
      ratePerKmOrTrip: String(ratePerKmOrTrip),
      pricingUnit: pricingUnit || "Per Trip",
      currency: currency || "USD",
      availableFrom: availableFrom || "Immediate",
      specialConditions: specialConditions || null,
      status: "active",
    }).returning();

    return NextResponse.json({ success: true, offer: newOffer });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
