import Product from "../models/Product.js";
import BuyerDemand from "../models/BuyerDemand.js";
import TransportOffer from "../models/TransportOffer.js";
import Shipment from "../models/Shipment.js";
import ConversationParticipant from "../models/ConversationParticipant.js";

export async function getDashboardSummary(req, res, next) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (user.role === "exporter") {
      const myProducts = await Product.find({ exporterId: user._id }).sort({ createdAt: -1 });
      const myShipments = await Shipment.find({ exporterId: user._id }).sort({ createdAt: -1 });
      const myConversations = await ConversationParticipant.find({ userId: user._id });
      const activeShipments = myShipments.filter((s) => s.status !== "delivered" && s.status !== "cancelled");

      return res.json({
        metrics: {
          activeProducts: myProducts.filter((p) => p.status === "active").length,
          totalProducts: myProducts.length,
          activeShipments: activeShipments.length,
          openDeals: myConversations.length,
        },
        recentProducts: myProducts.slice(0, 5),
        recentShipments: myShipments.slice(0, 4),
      });
    }

    if (user.role === "importer") {
      const myDemands = await BuyerDemand.find({ buyerId: user._id }).sort({ createdAt: -1 });
      const myShipments = await Shipment.find({ buyerId: user._id }).sort({ createdAt: -1 });
      const myConversations = await ConversationParticipant.find({ userId: user._id });
      const activeShipments = myShipments.filter((s) => s.status !== "delivered" && s.status !== "cancelled");

      return res.json({
        metrics: {
          openDemands: myDemands.filter((d) => d.status === "active").length,
          totalDemands: myDemands.length,
          incomingShipments: activeShipments.length,
          activeConversations: myConversations.length,
        },
        recentDemands: myDemands.slice(0, 5),
        recentShipments: myShipments.slice(0, 4),
      });
    }

    if (user.role === "driver") {
      const myOffers = await TransportOffer.find({ driverId: user._id }).sort({ createdAt: -1 });
      const myShipments = await Shipment.find({ driverId: user._id }).sort({ createdAt: -1 });
      const activeTrips = myShipments.filter((s) => s.status !== "delivered" && s.status !== "cancelled");
      const completedTrips = myShipments.filter((s) => s.status === "delivered");

      return res.json({
        metrics: {
          activeOffers: myOffers.filter((o) => o.status === "active").length,
          activeTrips: activeTrips.length,
          completedTrips: completedTrips.length,
          pendingRequests: myShipments.filter((s) => s.status === "booked").length,
        },
        recentOffers: myOffers.slice(0, 5),
        recentTrips: myShipments.slice(0, 4),
      });
    }

    // Default admin / general
    return res.json({
      metrics: {
        systemActive: true,
      },
    });
  } catch (err) {
    next(err);
  }
}
