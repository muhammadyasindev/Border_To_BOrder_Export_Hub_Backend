import User from "../models/User.js";
import Product from "../models/Product.js";
import BuyerDemand from "../models/BuyerDemand.js";
import TransportOffer from "../models/TransportOffer.js";

export async function getUserProfile(req, res, next) {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select(
      "fullName businessName role country city bio verificationStatus verifiedAt avatarUrl createdAt"
    );

    if (!user) {
      return res.status(404).json({ error: "User profile not found" });
    }

    let userProducts = [];
    let userDemands = [];
    let userOffers = [];

    if (user.role === "exporter") {
      userProducts = await Product.find({ exporterId: user._id }).limit(10);
    } else if (user.role === "importer") {
      userDemands = await BuyerDemand.find({ buyerId: user._id }).limit(10);
    } else if (user.role === "driver") {
      userOffers = await TransportOffer.find({ driverId: user._id }).limit(10);
    }

    res.json({
      user,
      products: userProducts,
      demands: userDemands,
      offers: userOffers,
    });
  } catch (err) {
    next(err);
  }
}
