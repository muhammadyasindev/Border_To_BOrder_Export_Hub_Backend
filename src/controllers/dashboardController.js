import Product from "../models/Product.js";
import ProductOffer from "../models/ProductOffer.js";
import BuyerDemand from "../models/BuyerDemand.js";
import TransportOffer from "../models/TransportOffer.js";
import TransportRequest from "../models/TransportRequest.js";
import Shipment from "../models/Shipment.js";
import ConversationParticipant from "../models/ConversationParticipant.js";
import Conversation from "../models/Conversation.js";

export async function getDashboardSummary(req, res, next) {
  try {
    // Global active counts and items with populated poster details from real database (excludes confirmed / exhausted listings)
    const [
      allActiveProducts,
      allActiveOffers,
      allActiveDemands,
      allActiveTransport,
      allActiveTransportRequests,
    ] = await Promise.all([
      Product.find({ status: "active", quantityAvailable: { $gt: 0 } })
        .populate("exporterId", "fullName email businessName country city verificationStatus avatarUrl phone")
        .sort({ createdAt: -1 })
        .limit(20),
      ProductOffer.find({ status: "active", validUntil: { $gt: new Date() } })
        .populate("productId", "title category pricePerUnit currency imageUrl originCountry originCity unit quantityAvailable")
        .populate("exporterId", "fullName email businessName country city verificationStatus avatarUrl phone")
        .sort({ createdAt: -1 })
        .limit(20),
      BuyerDemand.find({ status: "active", quantityRequired: { $gt: 0 } })
        .populate("buyerId", "fullName email businessName country city verificationStatus avatarUrl phone")
        .sort({ createdAt: -1 })
        .limit(20),
      TransportOffer.find({ status: "active", availableCapacityTons: { $gt: 0 } })
        .populate("driverId", "fullName email businessName country city verificationStatus avatarUrl phone truckPlateNumber")
        .sort({ createdAt: -1 })
        .limit(20),
      TransportRequest.find({ status: "active" })
        .populate("requesterId", "fullName email businessName role country city verificationStatus avatarUrl phone")
        .sort({ createdAt: -1 })
        .limit(20),
    ]);

    const user = req.user;
    if (!user) {
      return res.json({
        userStats: {
          activeProducts: 0,
          activeDeals: 0,
          pendingQuotations: 0,
          completedDeals: 0,
        },
        myListings: [],
        myConversations: [],
        allActiveProducts,
        allActiveOffers,
        allActiveDemands,
        allActiveTransport,
        allActiveTransportRequests,
      });
    }

    // Conversations / Calls history for the current user
    const userParticipants = await ConversationParticipant.find({ userId: user._id });
    const conversationIds = userParticipants.map((p) => p.conversationId);
    const myConversationsRaw = await Conversation.find({ _id: { $in: conversationIds } })
      .populate("productId", "title category pricePerUnit currency")
      .populate("productOfferId", "title offerPrice originalPrice currency")
      .populate("demandId", "title category targetPrice currency")
      .populate("transportOfferId", "title originCorridor destinationCorridor ratePerKmOrTrip currency")
      .populate("transportRequestId", "title cargoCategory pickupCountry destinationCountry currency")
      .sort({ updatedAt: -1 })
      .limit(10);

    const myConversations = await Promise.all(
      myConversationsRaw.map(async (c) => {
        const parts = await ConversationParticipant.find({ conversationId: c._id }).populate(
          "userId",
          "fullName businessName role country city verificationStatus avatarUrl phone"
        );
        return {
          ...c.toJSON(),
          participants: parts,
        };
      })
    );

    if (user.role === "exporter") {
      const [myProducts, myProductOffers, myTransportRequests, myShipments] = await Promise.all([
        Product.find({ exporterId: user._id }).sort({ createdAt: -1 }),
        ProductOffer.find({ exporterId: user._id }).populate("productId").sort({ createdAt: -1 }),
        TransportRequest.find({ requesterId: user._id }).sort({ createdAt: -1 }),
        Shipment.find({ exporterId: user._id }).sort({ createdAt: -1 }),
      ]);

      const activeShipments = myShipments.filter((s) => s.status !== "delivered" && s.status !== "cancelled");
      const totalTradeValue = myShipments.reduce((sum, s) => sum + (s.totalAmount || s.goodsValue || 0), 0);

      return res.json({
        role: "exporter",
        metrics: {
          totalTradeValue,
          activeProducts: myProducts.filter((p) => p.status === "active").length,
          totalProducts: myProducts.length,
          activeOffers: myProductOffers.filter((o) => o.status === "active").length,
          activeShipments: activeShipments.length,
          openDeals: myConversations.length,
          availableDemands: allActiveDemands.length,
          availableTransport: allActiveTransport.length,
          availableTransportRequests: allActiveTransportRequests.length,
        },
        marketplaceDemands: allActiveDemands,
        marketplaceProducts: allActiveProducts,
        marketplaceOffers: allActiveOffers,
        transportOffers: allActiveTransport,
        transportRequests: allActiveTransportRequests,
        myProducts,
        myProductOffers,
        myTransportRequests,
        myDemands: [],
        myOffers: [],
        myShipments: myShipments.slice(0, 5),
        myConversations,
      });
    }

    if (user.role === "importer") {
      const [myDemands, myTransportRequests, myShipments] = await Promise.all([
        BuyerDemand.find({ buyerId: user._id }).sort({ createdAt: -1 }),
        TransportRequest.find({ requesterId: user._id }).sort({ createdAt: -1 }),
        Shipment.find({ buyerId: user._id }).sort({ createdAt: -1 }),
      ]);

      const activeShipments = myShipments.filter((s) => s.status !== "delivered" && s.status !== "cancelled");
      const totalTradeValue = myShipments.reduce((sum, s) => sum + (s.totalAmount || s.goodsValue || 0), 0);

      return res.json({
        role: "importer",
        metrics: {
          totalTradeValue,
          openDemands: myDemands.filter((d) => d.status === "active").length,
          totalDemands: myDemands.length,
          openTransportRequests: myTransportRequests.filter((r) => r.status === "active").length,
          incomingShipments: activeShipments.length,
          activeConversations: myConversations.length,
          availableProducts: allActiveProducts.length,
          availableOffers: allActiveOffers.length,
          availableTransport: allActiveTransport.length,
        },
        marketplaceDemands: allActiveDemands,
        marketplaceProducts: allActiveProducts,
        marketplaceOffers: allActiveOffers,
        transportOffers: allActiveTransport,
        transportRequests: allActiveTransportRequests,
        myDemands,
        myTransportRequests,
        myProducts: [],
        myOffers: [],
        myShipments: myShipments.slice(0, 5),
        myConversations,
      });
    }

    if (user.role === "driver") {
      const [myOffers, myShipments] = await Promise.all([
        TransportOffer.find({ driverId: user._id }).sort({ createdAt: -1 }),
        Shipment.find({ driverId: user._id }).sort({ createdAt: -1 }),
      ]);

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
          availableProducts: allActiveProducts.length,
          availableTransportRequests: allActiveTransportRequests.length,
          openDeals: myConversations.length,
        },
        marketplaceDemands: allActiveDemands,
        marketplaceProducts: allActiveProducts,
        marketplaceOffers: allActiveOffers,
        transportOffers: allActiveTransport,
        transportRequests: allActiveTransportRequests,
        otherDriverOffers: allActiveTransport.filter((t) => String(t.driverId?._id || t.driverId) !== String(user._id)),
        myOffers,
        myProducts: [],
        myDemands: [],
        myTrips: myShipments.slice(0, 5),
        myConversations,
      });
    }

    // Administrator
    const [allProductsCount, allDemandsCount, allShipmentsCount, allOffersCount, allTransportReqCount] = await Promise.all([
      Product.countDocuments(),
      BuyerDemand.countDocuments(),
      Shipment.countDocuments(),
      ProductOffer.countDocuments(),
      TransportRequest.countDocuments(),
    ]);

    return res.json({
      role: "admin",
      metrics: {
        totalTradeValue: 0,
        totalProducts: allProductsCount,
        totalDemands: allDemandsCount,
        totalShipments: allShipmentsCount,
        totalOffers: allOffersCount,
        totalTransportRequests: allTransportReqCount,
        systemActive: true,
      },
      marketplaceDemands: allActiveDemands,
      marketplaceProducts: allActiveProducts,
      marketplaceOffers: allActiveOffers,
      transportOffers: allActiveTransport,
      transportRequests: allActiveTransportRequests,
      myConversations,
    });
  } catch (err) {
    next(err);
  }
}
