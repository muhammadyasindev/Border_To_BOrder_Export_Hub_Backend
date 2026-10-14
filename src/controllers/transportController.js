import mongoose from "mongoose";
import TransportOffer from "../models/TransportOffer.js";
import TransportRequest from "../models/TransportRequest.js";

// ==========================================
// 1. TRANSPORT OFFERS (Published by Drivers)
// ==========================================

// Get Transport Offers with Filters
export async function getOffers(req, res, next) {
  try {
    const {
      originCorridor,
      destinationCorridor,
      vehicleType,
      search,
      status = "active",
      myOnly,
      limit = 50,
      skip = 0,
    } = req.query;

    const filter = {};

    if (myOnly === "true") {
      if (!req.user) return res.status(401).json({ error: "Auth required for my offers" });
      filter.driverId = req.user._id;
      if (req.query.status && req.query.status !== "all") filter.status = req.query.status;
    } else {
      filter.status = "active";
      filter.availableCapacityTons = { $gt: 0 };
    }

    if (originCorridor && originCorridor !== "All") filter.originCorridor = originCorridor;
    if (destinationCorridor && destinationCorridor !== "All") filter.destinationCorridor = destinationCorridor;
    if (vehicleType && vehicleType !== "All") filter.vehicleType = vehicleType;

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { originCorridor: { $regex: search, $options: "i" } },
        { destinationCorridor: { $regex: search, $options: "i" } },
        { cargoCategory: { $regex: search, $options: "i" } },
      ];
    }

    const [offers, total] = await Promise.all([
      TransportOffer.find(filter)
        .populate("driverId", "fullName businessName country city verificationStatus avatarUrl phone truckPlateNumber")
        .populate("vehicleId", "vehicleType makeModel plateNumberMasked capacityTons")
        .sort({ createdAt: -1 })
        .limit(parseInt(limit, 10))
        .skip(parseInt(skip, 10)),
      TransportOffer.countDocuments(filter),
    ]);

    res.json({
      offers,
      total,
      limit: parseInt(limit, 10),
      skip: parseInt(skip, 10),
    });
  } catch (err) {
    next(err);
  }
}

// Get Transport Offer by ID
export async function getOfferById(req, res, next) {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: "Invalid transport offer ID" });
    }
    const offer = await TransportOffer.findById(id)
      .populate("driverId", "fullName businessName country city verificationStatus avatarUrl phone truckPlateNumber")
      .populate("vehicleId");
    if (!offer) return res.status(404).json({ error: "Transport offer not found" });
    res.json(offer);
  } catch (err) {
    next(err);
  }
}

// Create Transport Offer (Driver Only)
export async function createOffer(req, res, next) {
  try {
    if (req.user.role !== "driver" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Only drivers and transport providers can publish haulage offers" });
    }

    const {
      title,
      vehicleId,
      vehicleType,
      vehicleCapacity,
      currentLocation,
      originCorridor,
      destinationCorridor,
      availableCapacityTons,
      cargoCategory,
      ratePerKmOrTrip,
      pricingUnit,
      pricingBasis,
      currency,
      availableFrom,
      availabilityDates,
      estimatedDeliveryTime,
      transportConditions,
      specialConditions,
    } = req.body;

    const cleanNumber = (val, defaultVal = 0) => {
      if (typeof val === "number" && !isNaN(val)) return val;
      if (!val) return defaultVal;
      const parsed = parseFloat(String(val).replace(/[^0-9.]/g, ""));
      return isNaN(parsed) ? defaultVal : parsed;
    };

    const origCorridor = originCorridor || req.body.origin || req.body.originCountry || req.user.country || "Pakistan";
    const destCorridor = destinationCorridor || req.body.destination || req.body.destinationCountry || "Afghanistan";
    const capTons = cleanNumber(availableCapacityTons || vehicleCapacity || req.body.capacity, 20);
    const rateVal = cleanNumber(ratePerKmOrTrip || req.body.price || req.body.rate, 0);
    const vType = vehicleType || req.body.truckType || "Heavy Articulated Truck (6x4)";
    const offerTitle = (title || `${vType} - ${origCorridor} to ${destCorridor}`).trim();

    if (!offerTitle || !origCorridor || !destCorridor) {
      return res.status(400).json({ error: "Missing required transport offer fields (title, corridors)" });
    }

    const offer = await TransportOffer.create({
      driverId: req.user._id,
      vehicleId: vehicleId || null,
      title: offerTitle,
      vehicleType: vType,
      vehicleCapacity: cleanNumber(vehicleCapacity, capTons),
      currentLocation: currentLocation || req.body.currentOrPickupLocation || origCorridor,
      originCorridor: origCorridor,
      destinationCorridor: destCorridor,
      availableCapacityTons: capTons,
      cargoCategory: cargoCategory || "General Freight",
      ratePerKmOrTrip: rateVal,
      pricingUnit: pricingUnit || pricingBasis || "Per Trip",
      pricingBasis: pricingBasis || pricingUnit || "Per Trip",
      currency: currency || "USD",
      availableFrom: availableFrom || new Date().toISOString().split("T")[0],
      availabilityDates: availabilityDates || "Immediate",
      estimatedDeliveryTime: estimatedDeliveryTime || "24-48 Hours",
      transportConditions: transportConditions || specialConditions || "",
      specialConditions: specialConditions || null,
      status: "active",
    });

    const populated = await TransportOffer.findById(offer._id)
      .populate("driverId", "fullName businessName country city verificationStatus avatarUrl phone truckPlateNumber")
      .populate("vehicleId");

    const json = populated.toJSON();
    res.status(201).json({ offer: populated, ...json });
  } catch (err) {
    next(err);
  }
}

// Update Transport Offer
export async function updateOffer(req, res, next) {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: "Invalid transport offer ID" });
    }
    const offer = await TransportOffer.findById(id);
    if (!offer) return res.status(404).json({ error: "Offer not found" });

    if (offer.driverId.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized to update this offer" });
    }

    const allowedFields = [
      "title",
      "vehicleId",
      "vehicleType",
      "vehicleCapacity",
      "currentLocation",
      "originCorridor",
      "destinationCorridor",
      "availableCapacityTons",
      "cargoCategory",
      "ratePerKmOrTrip",
      "pricingUnit",
      "pricingBasis",
      "currency",
      "availableFrom",
      "availabilityDates",
      "estimatedDeliveryTime",
      "transportConditions",
      "specialConditions",
      "status",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === "availableCapacityTons" || field === "ratePerKmOrTrip" || field === "vehicleCapacity") {
          offer[field] = Number(req.body[field]);
        } else {
          offer[field] = req.body[field];
        }
      }
    });

    await offer.save();

    const populated = await TransportOffer.findById(offer._id)
      .populate("driverId", "fullName businessName country city verificationStatus avatarUrl phone truckPlateNumber")
      .populate("vehicleId");

    res.json(populated);
  } catch (err) {
    next(err);
  }
}

// Update Transport Offer Status (Pause / Withdraw / Activate)
export async function updateOfferStatus(req, res, next) {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: "Invalid transport offer ID" });
    }
    const { status } = req.body;

    let targetStatus = status;
    if (targetStatus === "available") targetStatus = "active";

    if (!["active", "paused", "booked", "withdrawn"].includes(targetStatus)) {
      return res.status(400).json({ error: "Invalid status. Allowed: active, paused, booked, withdrawn" });
    }

    const offer = await TransportOffer.findById(id);
    if (!offer) return res.status(404).json({ error: "Offer not found" });

    if (offer.driverId.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized to update this offer" });
    }

    offer.status = targetStatus;
    await offer.save();

    res.json({ success: true, offer });
  } catch (err) {
    next(err);
  }
}

// Delete Transport Offer
export async function deleteOffer(req, res, next) {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: "Invalid transport offer ID" });
    }
    const offer = await TransportOffer.findById(id);
    if (!offer) return res.status(404).json({ error: "Offer not found" });

    if (offer.driverId.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized to delete this offer" });
    }

    await TransportOffer.findByIdAndDelete(id);
    res.json({ success: true, message: "Transport offer deleted" });
  } catch (err) {
    next(err);
  }
}

// ==============================================================
// 2. TRANSPORT REQUESTS (Published by Importers & Exporters)
// ==============================================================

// Get Transport Requests
export async function getTransportRequests(req, res, next) {
  try {
    const {
      pickupCountry,
      destinationCountry,
      cargoCategory,
      search,
      status = "active",
      myOnly,
      limit = 50,
      skip = 0,
    } = req.query;

    const filter = {};

    if (myOnly === "true") {
      if (!req.user) return res.status(401).json({ error: "Auth required for my transport requests" });
      filter.requesterId = req.user._id;
      if (req.query.status && req.query.status !== "all") filter.status = req.query.status;
    } else {
      filter.status = "active";
    }

    if (pickupCountry && pickupCountry !== "All") filter.pickupCountry = pickupCountry;
    if (destinationCountry && destinationCountry !== "All") filter.destinationCountry = destinationCountry;
    if (cargoCategory && cargoCategory !== "All") filter.cargoCategory = cargoCategory;

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { cargoDescription: { $regex: search, $options: "i" } },
        { pickupCity: { $regex: search, $options: "i" } },
        { destinationCity: { $regex: search, $options: "i" } },
      ];
    }

    const [requests, total] = await Promise.all([
      TransportRequest.find(filter)
        .populate("requesterId", "fullName businessName role country city verificationStatus avatarUrl phone")
        .sort({ createdAt: -1 })
        .limit(parseInt(limit, 10))
        .skip(parseInt(skip, 10)),
      TransportRequest.countDocuments(filter),
    ]);

    res.json({
      requests,
      total,
      limit: parseInt(limit, 10),
      skip: parseInt(skip, 10),
    });
  } catch (err) {
    next(err);
  }
}

// Get Transport Request by ID
export async function getTransportRequestById(req, res, next) {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: "Invalid transport request ID" });
    }
    const request = await TransportRequest.findById(id).populate(
      "requesterId",
      "fullName businessName role country city verificationStatus avatarUrl phone"
    );
    if (!request) return res.status(404).json({ error: "Transport request not found" });
    res.json(request);
  } catch (err) {
    next(err);
  }
}

// Create Transport Request (Importer or Exporter)
export async function createTransportRequest(req, res, next) {
  try {
    if (req.user.role !== "importer" && req.user.role !== "exporter" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Only importers and exporters can publish transport cargo requirements" });
    }

    const {
      title,
      cargoDescription,
      cargoCategory,
      quantity,
      unit,
      weightTons,
      volumeCbm,
      pickupCountry,
      pickupCity,
      pickupLocation,
      destinationCountry,
      destinationCity,
      destinationLocation,
      preferredRoute,
      pickupDate,
      deliveryDeadline,
      vehicleRequirements,
      offeredBudget,
      currency,
      specialHandling,
    } = req.body;

    const pCountry = pickupCountry || req.user.country || "Pakistan";
    const dCountry = destinationCountry || "Afghanistan";
    const desc = (cargoDescription || req.body.cargo || req.body.description || "").trim();
    const reqTitle = (title || `Cargo Haulage: ${desc.slice(0, 30)} (${pCountry} ➔ ${dCountry})`).trim();

    if (!desc || quantity == null) {
      return res.status(400).json({ error: "Missing required fields (cargo description, quantity)" });
    }

    const transportReq = await TransportRequest.create({
      requesterId: req.user._id,
      requesterRole: req.user.role === "admin" ? "exporter" : req.user.role,
      title: reqTitle,
      cargoDescription: desc,
      cargoCategory: cargoCategory || "Agricultural Cargo",
      quantity: Number(quantity),
      unit: unit || "Metric Tons",
      weightTons: weightTons ? Number(weightTons) : Number(quantity),
      volumeCbm: volumeCbm ? Number(volumeCbm) : null,
      pickupCountry: pCountry,
      pickupCity: pickupCity || "Trade Hub",
      pickupLocation: pickupLocation || "",
      destinationCountry: dCountry,
      destinationCity: destinationCity || "Border Post",
      destinationLocation: destinationLocation || "",
      preferredRoute: preferredRoute || `${pCountry} ➔ ${dCountry}`,
      pickupDate: pickupDate ? new Date(pickupDate) : null,
      deliveryDeadline: deliveryDeadline ? new Date(deliveryDeadline) : null,
      vehicleRequirements: vehicleRequirements || "Flatbed / Heavy Articulated Truck",
      offeredBudget: offeredBudget ? Number(offeredBudget) : null,
      currency: currency || "USD",
      specialHandling: specialHandling || "",
      status: "active",
    });

    const populated = await TransportRequest.findById(transportReq._id).populate(
      "requesterId",
      "fullName businessName role country city verificationStatus avatarUrl phone"
    );

    const json = populated.toJSON();
    res.status(201).json({ request: populated, ...json });
  } catch (err) {
    next(err);
  }
}

// Update Transport Request
export async function updateTransportRequest(req, res, next) {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: "Invalid transport request ID" });
    }
    const transportReq = await TransportRequest.findById(id);
    if (!transportReq) return res.status(404).json({ error: "Transport request not found" });

    if (transportReq.requesterId.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized to update this transport request" });
    }

    const allowedFields = [
      "title",
      "cargoDescription",
      "cargoCategory",
      "quantity",
      "unit",
      "weightTons",
      "volumeCbm",
      "pickupCountry",
      "pickupCity",
      "pickupLocation",
      "destinationCountry",
      "destinationCity",
      "destinationLocation",
      "preferredRoute",
      "pickupDate",
      "deliveryDeadline",
      "vehicleRequirements",
      "offeredBudget",
      "currency",
      "specialHandling",
      "status",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === "quantity" || field === "weightTons" || field === "volumeCbm" || field === "offeredBudget") {
          transportReq[field] = req.body[field] ? Number(req.body[field]) : null;
        } else {
          transportReq[field] = req.body[field];
        }
      }
    });

    await transportReq.save();

    const populated = await TransportRequest.findById(transportReq._id).populate(
      "requesterId",
      "fullName businessName role country city verificationStatus avatarUrl phone"
    );

    res.json(populated);
  } catch (err) {
    next(err);
  }
}

// Update Transport Request Status
export async function updateTransportRequestStatus(req, res, next) {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: "Invalid transport request ID" });
    }
    const { status } = req.body;

    if (!["active", "quoted", "booked", "paused", "cancelled"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const transportReq = await TransportRequest.findById(id);
    if (!transportReq) return res.status(404).json({ error: "Transport request not found" });

    if (transportReq.requesterId.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    transportReq.status = status;
    await transportReq.save();

    res.json({ success: true, transportReq });
  } catch (err) {
    next(err);
  }
}

// Delete Transport Request
export async function deleteTransportRequest(req, res, next) {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: "Invalid transport request ID" });
    }
    const transportReq = await TransportRequest.findById(id);
    if (!transportReq) return res.status(404).json({ error: "Transport request not found" });

    if (transportReq.requesterId.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized to delete this transport request" });
    }

    await TransportRequest.findByIdAndDelete(id);
    res.json({ success: true, message: "Transport request deleted" });
  } catch (err) {
    next(err);
  }
}
