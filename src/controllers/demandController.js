import BuyerDemand from "../models/BuyerDemand.js";

export async function getDemands(req, res, next) {
  try {
    const { category, destinationCountry, search, status = "active", limit = 50, skip = 0 } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (category && category !== "All") filter.category = category;
    if (destinationCountry && destinationCountry !== "All") filter.destinationCountry = destinationCountry;

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { specifications: { $regex: search, $options: "i" } },
        { destinationCity: { $regex: search, $options: "i" } },
      ];
    }

    const demands = await BuyerDemand.find(filter)
      .populate("buyerId", "fullName businessName country city verificationStatus avatarUrl")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10))
      .skip(parseInt(skip, 10));

    res.json(demands);
  } catch (err) {
    next(err);
  }
}

export async function createDemand(req, res, next) {
  try {
    const {
      title,
      category,
      specifications,
      quantityRequired,
      unit,
      targetPrice,
      currency,
      preferredOrigin,
      destinationCountry,
      destinationCity,
      deliveryDeadline,
      packagingRequirements,
    } = req.body;

    if (!title || !category || !specifications || quantityRequired == null) {
      return res.status(400).json({ error: "Missing required buying demand fields" });
    }

    const demand = await BuyerDemand.create({
      buyerId: req.user._id,
      title: title.trim(),
      category,
      specifications: specifications.trim(),
      quantityRequired: Number(quantityRequired),
      unit: unit || "Metric Tons",
      targetPrice: targetPrice != null ? Number(targetPrice) : null,
      currency: currency || "USD",
      preferredOrigin: preferredOrigin || "Any",
      destinationCountry: destinationCountry || req.user.country || "Afghanistan",
      destinationCity: destinationCity || req.user.city || "Kandahar",
      deliveryDeadline: deliveryDeadline || null,
      packagingRequirements: packagingRequirements || null,
      status: "active",
    });

    const populated = await BuyerDemand.findById(demand._id).populate(
      "buyerId",
      "fullName businessName country city verificationStatus avatarUrl"
    );

    res.status(201).json(populated);
  } catch (err) {
    next(err);
  }
}
