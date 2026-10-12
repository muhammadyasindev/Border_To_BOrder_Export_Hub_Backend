import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { vehicles, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const driverIdParam = searchParams.get("driverId");

    // If driver, see their own full plates; others only see masked plates
    const targetDriverId = driverIdParam ? Number(driverIdParam) : user.id;

    const vehicleList = await db.select().from(vehicles)
      .where(eq(vehicles.driverId, targetDriverId))
      .orderBy(desc(vehicles.createdAt));

    // Sanitization: hide plateNumberFull unless viewer is the owner or admin
    const sanitized = vehicleList.map((v: any) => {
      if (user.id === v.driverId || user.role === "admin") {
        return v;
      }
      return {
        ...v,
        plateNumberFull: "[Restricted - Authorized Parties Only]",
      };
    });

    return NextResponse.json({ vehicles: sanitized });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "driver" && user.role !== "admin")) {
    return NextResponse.json({ error: "Only registered drivers can register vehicles" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      vehicleType,
      makeModel,
      registrationCountry,
      plateNumber,
      capacityTons,
      supportedCargo,
      supportedCorridors,
    } = body;

    if (!vehicleType || !makeModel || !plateNumber || !capacityTons) {
      return NextResponse.json({ error: "Missing required vehicle specifications" }, { status: 400 });
    }

    // Mask plate number for public safety
    const plateClean = plateNumber.trim();
    const parts = plateClean.split("-");
    const masked = parts.length > 2
      ? `${parts[0]}-***-${parts[parts.length - 1]}`
      : `${plateClean.slice(0, 3)}***${plateClean.slice(-2)}`;

    const [newVehicle] = await db.insert(vehicles).values({
      driverId: user.id,
      vehicleType,
      makeModel,
      registrationCountry: registrationCountry || user.country,
      plateNumberFull: plateClean,
      plateNumberMasked: masked,
      capacityTons: String(capacityTons),
      supportedCargo: supportedCargo || "Dry Bulk, General Cargo",
      supportedCorridors: supportedCorridors || "Quetta-Taftan, Chaman-Spin Boldak",
      isAvailable: true,
      verificationStatus: "verified",
    }).returning();

    return NextResponse.json({ success: true, vehicle: newVehicle });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
