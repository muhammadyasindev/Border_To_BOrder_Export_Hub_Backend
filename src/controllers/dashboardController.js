import Product from "../models/Product.js";
import BuyerDemand from "../models/BuyerDemand.js";
import TransportOffer from "../models/TransportOffer.js";
import Shipment from "../models/Shipment.js";
import ConversationParticipant from "../models/ConversationParticipant.js";
import Conversation from "../models/Conversation.js";

export async function getDashboardSummary(req, res, next) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Global active counts from real database
    const [allActiveProducts, allActiveDemands, allActiveTransport] = await Promise.all([
      Product.find({ status: "active" }).sort({ createdAt: -1 }).limit(8),
      BuyerDemand.find({ status: "active" }).sort({ createdAt: -1 }).limit(8),
      TransportOffer.find({ status: "active" }).sort({ createdAt: -1 }).limit(8),
    ]);

    // Conversations / Calls history for the current user
    const userParticipants = await ConversationParticipant.find({ userId: user._id });
    const conversationIds = userParticipants.map((p) => p.conversationId);
    const myConversations = await Conversation.find({ _id: { $in: conversationIds } })
      .sort({ updatedAt: -1 })
      .limit(6);

    if (user.role === "exporter") {
      const myProducts = await Product.find({ exporterId: user._id }).sort({ createdAt: -1 });
      const myShipments = await Shipment.find({ exporterId: user._id }).sort({ createdAt: -1 });
      const activeShipments = myShipments.filter((s) => s.status !== "delivered" && s.status !== "cancelled");
      const totalTradeValue = myShipments.reduce((sum, s) => sum + (s.totalAmount || s.goodsValue || 0), 0);

      return res.json({
        role: "exporter",
        metrics: {
          totalTradeValue,
          activeProducts: myProducts.filter((p) => p.status === "active").length,
          totalProducts: myProducts.length,
          activeShipments: activeShipments.length,
          openDeals: myConversations.length,
          availableDemands: allActiveDemands.length,
        },
        marketplaceDemands: allActiveDemands,
        marketplaceProducts: allActiveProducts,
        myProducts,
        myShipments: myShipments.slice(0, 5),
        myConversations,
      });
    }

    if (user.role === "importer") {
      const myDemands = await BuyerDemand.find({ buyerId: user._id }).sort({ createdAt: -1 });
      const myShipments = await Shipment.find({ buyerId: user._id }).sort({ createdAt: -1 });
      const activeShipments = myShipments.filter((s) => s.status !== "delivered" && s.status !== "cancelled");
      const totalTradeValue = myShipments.reduce((sum, s) => sum + (s.totalAmount || s.goodsValue || 0), 0);

      return res.json({
        role: "importer",
        metrics: {
          totalTradeValue,
          openDemands: myDemands.filter((d) => d.status === "active").length,
          totalDemands: myDemands.length,
          incomingShipments: activeShipments.length,
          activeConversations: myConversations.length,
          availableProducts: allActiveProducts.length,
        },
        marketplaceProducts: allActiveProducts,
        transportOffers: allActiveTransport,
        myDemands,
        myShipments: myShipments.slice(0, 5),
        myConversations,
      });
    }

    if (user.role === "driver") {
      const myOffers = await TransportOffer.find({ driverId: user._id }).sort({ createdAt: -1 });
      const myShipments = await Shipment.find({ driverId: user._id }).sort({ createdAt: -1 });
      const activeTrips = myShipments.filter((s) => s.status !== "delivered" && s.status !== "cancelled");
      const completedTrips = myShipments.filter((s) => s.status === "delivered");
      const totalTradeValue = myShipments.reduce((sum, s) => sum + (s.freightCharges || s.totalAmount || 0), 0);

      return res.json({
        role: "driver",
        metrics: {
          totalTradeValue,
          activeOffers: myOffers.filter((o) => o.status === "active").length,
          activeTrips: activeTrips.length,
          completedTrips: completedTrips.length,
          availableDemands: allActiveDemands.length,
          openDeals: myConversations.length,
        },
        availableDemands: allActiveDemands,
        otherDriverOffers: allActiveTransport.filter((t) => String(t.driverId) !== String(user._id)),
        myOffers,
        myTrips: myShipments.slice(0, 5),
        myConversations,
      });
    }

    // Administrator
    const [allProductsCount, allDemandsCount, allShipmentsCount] = await Promise.all([
      Product.countDocuments(),
      BuyerDemand.countDocuments(),
      Shipment.countDocuments(),
    ]);

    return res.json({
      role: "admin",
      metrics: {
        totalTradeValue: 0,
        totalProducts: allProductsCount,
        totalDemands: allDemandsCount,
        totalShipments: allShipmentsCount,
        systemActive: true,
      },
      marketplaceDemands: allActiveDemands,
      marketplaceProducts: allActiveProducts,
      transportOffers: allActiveTransport,
      myConversations,
    });
  } catch (err) {
    next(err);
  }
}
