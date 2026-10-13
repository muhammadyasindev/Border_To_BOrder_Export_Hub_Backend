import TransportOffer from "../models/TransportOffer.js";

export async function getOffers(req, res, next) {
  try {
    const { originCorridor, destinationCorridor, status = "active", limit = 50 } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (originCorridor && originCorridor !== "All") filter.originCorridor = originCorridor;
    if (destinationCorridor && destinationCorridor !== "All") filter.destinationCorridor = destinationCorridor;

    const offers = await TransportOffer.find(filter)
      .populate("driverId", "fullName businessName country city verificationStatus avatarUrl phone")
      .populate("vehicleId", "vehicleType makeModel plateNumberMasked capacityTons")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10));

    res.json(offers);
  } catch (err) {
    next(err);
  }
}

export async function createOffer(req, res, next) {
  try {
    const {
      title,
      vehicleId,
      originCorridor,
      destinationCorridor,
      availableCapacityTons,
      cargoCategory,
      ratePerKmOrTrip,
      pricingUnit,
      currency,
      availableFrom,
      specialConditions,
    } = req.body;

    if (!title || !originCorridor || !destinationCorridor || !availableCapacityTons || !ratePerKmOrTrip) {
      return res.status(400).json({ error: "Missing required transport offer fields" });
    }

    const offer = await TransportOffer.create({
      driverId: req.user._id,
      vehicleId: vehicleId || null,
      title: title.trim(),
      originCorridor,
      destinationCorridor,
      availableCapacityTons: Number(availableCapacityTons),
      cargoCategory: cargoCategory || "General Freight",
      ratePerKmOrTrip: Number(ratePerKmOrTrip),
      pricingUnit: pricingUnit || "Per Trip",
      currency: currency || "USD",
      availableFrom: availableFrom || new Date().toISOString().split("T")[0],
      specialConditions: specialConditions || null,
      status: "active",
    });

    const populated = await TransportOffer.findById(offer._id)
      .populate("driverId", "fullName businessName country city verificationStatus avatarUrl phone")
      .populate("vehicleId", "vehicleType makeModel plateNumberMasked capacityTons");

    res.status(201).json(populated);
  } catch (err) {
    next(err);
  }
}
