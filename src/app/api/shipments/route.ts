import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { shipments, users, vehicles, conversations } from "@/db/schema";
import { eq, or, and, desc } from "drizzle-orm";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Only return shipments where user is exporter, buyer, driver, or admin
    let query = db.select({
      id: shipments.id,
      trackingNumber: shipments.trackingNumber,
      conversationId: shipments.conversationId,
      exporterId: shipments.exporterId,
      buyerId: shipments.buyerId,
      driverId: shipments.driverId,
      vehicleId: shipments.vehicleId,
      cargoDescription: shipments.cargoDescription,
      cargoWeightTons: shipments.cargoWeightTons,
      pickupLocation: shipments.pickupLocation,
      borderCrossing: shipments.borderCrossing,
      destinationLocation: shipments.destinationLocation,
      status: shipments.status,
      currentLatitude: shipments.currentLatitude,
      currentLongitude: shipments.currentLongitude,
      locationSharingActive: shipments.locationSharingActive,
      lastCheckpoint: shipments.lastCheckpoint,
      lastLocationUpdate: shipments.lastLocationUpdate,
      scheduledPickupDate: shipments.scheduledPickupDate,
      estimatedDeliveryDate: shipments.estimatedDeliveryDate,
      actualDeliveryDate: shipments.actualDeliveryDate,
      exporterName: users.fullName,
    })
    .from(shipments)
    .leftJoin(users, eq(shipments.exporterId, users.id))
    .orderBy(desc(shipments.createdAt));

    let list;
    if (user.role === "admin") {
      list = await query;
    } else {
      list = await query.where(
        or(
          eq(shipments.exporterId, user.id),
          eq(shipments.buyerId, user.id),
          eq(shipments.driverId, user.id)
        )
      );
    }

    // Attach driver details and sanitize vehicle plates if not authorized
    const detailed = await Promise.all(list.map(async (s: any) => {
      const [driver] = await db.select({
        id: users.id,
        fullName: users.fullName,
        businessName: users.businessName,
        phone: users.phone,
        verificationStatus: users.verificationStatus,
      }).from(users).where(eq(users.id, s.driverId)).limit(1);

      const [buyer] = await db.select({
        id: users.id,
        fullName: users.fullName,
        businessName: users.businessName,
        city: users.city,
      }).from(users).where(eq(users.id, s.buyerId)).limit(1);

      let vehicle = null;
      if (s.vehicleId) {
        const [v] = await db.select().from(vehicles).where(eq(vehicles.id, s.vehicleId)).limit(1);
        if (v) {
          vehicle = {
            vehicleType: v.vehicleType,
            makeModel: v.makeModel,
            plateNumberMasked: v.plateNumberMasked,
            capacityTons: v.capacityTons,
          };
        }
      }

      // Check location sharing permission: if locationSharingActive is false or trip completed, do not return coordinates
      const isCoordinatesVisible = s.locationSharingActive && (s.status !== "delivered" && s.status !== "cancelled");

      return {
        ...s,
        driver,
        buyer,
        vehicle,
        currentLatitude: isCoordinatesVisible ? s.currentLatitude : null,
        currentLongitude: isCoordinatesVisible ? s.currentLongitude : null,
      };
    }));

    return NextResponse.json({ shipments: detailed });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Create new shipment booking
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      conversationId,
      exporterId,
      buyerId,
      driverId,
      vehicleId,
      cargoDescription,
      cargoWeightTons,
      pickupLocation,
      borderCrossing,
      destinationLocation,
      scheduledPickupDate,
      estimatedDeliveryDate,
    } = body;

    if (!cargoDescription || !cargoWeightTons || !pickupLocation || !destinationLocation || !borderCrossing) {
      return NextResponse.json({ error: "Missing required booking details" }, { status: 400 });
    }

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const trackingNumber = `BG-TRK-${randomSuffix}`;

    const [newShipment] = await db.insert(shipments).values({
      trackingNumber,
      conversationId: conversationId ? Number(conversationId) : null,
      exporterId: exporterId ? Number(exporterId) : user.id,
      buyerId: buyerId ? Number(buyerId) : user.id,
      driverId: Number(driverId),
      vehicleId: vehicleId ? Number(vehicleId) : null,
      cargoDescription,
      cargoWeightTons: String(cargoWeightTons),
      pickupLocation,
      borderCrossing,
      destinationLocation,
      scheduledPickupDate: scheduledPickupDate || "2025-05-18",
      estimatedDeliveryDate: estimatedDeliveryDate || "2025-05-24",
      status: "booked",
      lastCheckpoint: `Origin: ${pickupLocation}`,
      locationSharingActive: true,
      currentLatitude: "29.8944", // Initializing along Quetta corridor
      currentLongitude: "66.5082",
      lastLocationUpdate: new Date(),
    }).returning();

    // If conversation linked, update deal status
    if (conversationId) {
      await db.update(conversations).set({
        dealStatus: "booked",
        updatedAt: new Date(),
      }).where(eq(conversations.id, Number(conversationId)));
    }

    return NextResponse.json({ success: true, shipment: newShipment });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Update shipment status or update driver GPS checkpoint
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { shipmentId, status, lastCheckpoint, latitude, longitude, locationSharingActive } = body;

    if (!shipmentId) {
      return NextResponse.json({ error: "shipmentId required" }, { status: 400 });
    }

    const [shipment] = await db.select().from(shipments).where(eq(shipments.id, Number(shipmentId))).limit(1);
    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    // Only assigned driver, exporter, buyer, or admin can update
    const isDriver = shipment.driverId === user.id;
    const isParty = isDriver || shipment.exporterId === user.id || shipment.buyerId === user.id || user.role === "admin";

    if (!isParty) {
      return NextResponse.json({ error: "Forbidden: Not an authorized party to this shipment" }, { status: 403 });
    }

    const updateFields: any = { updatedAt: new Date() };

    if (status) {
      updateFields.status = status;
      if (status === "delivered") {
        updateFields.actualDeliveryDate = new Date().toISOString().split("T")[0];
        updateFields.locationSharingActive = false;
      }
    }

    if (lastCheckpoint) {
      updateFields.lastCheckpoint = lastCheckpoint;
    }

    // Drivers can push their real/updated coordinates
    if (isDriver && latitude && longitude) {
      updateFields.currentLatitude = String(latitude);
      updateFields.currentLongitude = String(longitude);
      updateFields.lastLocationUpdate = new Date();
    }

    if (locationSharingActive !== undefined && isDriver) {
      updateFields.locationSharingActive = Boolean(locationSharingActive);
    }

    const [updated] = await db.update(shipments).set(updateFields).where(eq(shipments.id, Number(shipmentId))).returning();

    return NextResponse.json({ success: true, shipment: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
