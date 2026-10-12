import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { products, buyerDemands, transportOffers, shipments, conversations, conversationParticipants } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (user.role === "exporter") {
      const myProducts = await db.select().from(products).where(eq(products.exporterId, user.id));
      const myShipments = await db.select().from(shipments).where(eq(shipments.exporterId, user.id));
      const myConversations = await db.select().from(conversationParticipants).where(eq(conversationParticipants.userId, user.id));
      const activeShipments = myShipments.filter((s: any) => s.status !== "delivered" && s.status !== "cancelled");

      return NextResponse.json({
        metrics: {
          activeProducts: myProducts.filter((p: any) => p.status === "active").length,
          totalProducts: myProducts.length,
          activeShipments: activeShipments.length,
          openDeals: myConversations.length,
        },
        recentProducts: myProducts.slice(0, 5),
        recentShipments: myShipments.slice(0, 4),
      });
    }

    if (user.role === "importer") {
      const myDemands = await db.select().from(buyerDemands).where(eq(buyerDemands.buyerId, user.id));
      const myShipments = await db.select().from(shipments).where(eq(shipments.buyerId, user.id));
      const myConversations = await db.select().from(conversationParticipants).where(eq(conversationParticipants.userId, user.id));
      const activeShipments = myShipments.filter((s: any) => s.status !== "delivered" && s.status !== "cancelled");

      return NextResponse.json({
        metrics: {
          openDemands: myDemands.filter((d: any) => d.status === "active").length,
          totalDemands: myDemands.length,
          incomingShipments: activeShipments.length,
          activeConversations: myConversations.length,
        },
        recentDemands: myDemands.slice(0, 5),
        recentShipments: myShipments.slice(0, 4),
      });
    }

    if (user.role === "driver") {
      const myOffers = await db.select().from(transportOffers).where(eq(transportOffers.driverId, user.id));
      const myShipments = await db.select().from(shipments).where(eq(shipments.driverId, user.id));
      const activeTrips = myShipments.filter((s: any) => s.status !== "delivered" && s.status !== "cancelled");
      const completedTrips = myShipments.filter((s: any) => s.status === "delivered");

      return NextResponse.json({
        metrics: {
          activeOffers: myOffers.filter((o: any) => o.status === "active").length,
          activeTrips: activeTrips.length,
          completedTrips: completedTrips.length,
          pendingRequests: myShipments.filter((s: any) => s.status === "booked").length,
        },
        recentOffers: myOffers.slice(0, 5),
        recentTrips: myShipments.slice(0, 4),
      });
    }

    // Default admin / general
    return NextResponse.json({
      metrics: {
        systemActive: true,
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
