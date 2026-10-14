import Shipment from "../models/Shipment.js";
import crypto from "crypto";

export async function getShipments(req, res, next) {
  try {
    if (!req.user) {
      return res.json([]);
    }
    const userId = req.user._id;
    const filter = {
      $or: [{ exporterId: userId }, { buyerId: userId }, { driverId: userId }],
    };

    if (req.query.status) {
      filter.status = req.query.status;
    }

    const shipments = await Shipment.find(filter)
      .populate("exporterId", "fullName businessName country city")
      .populate("buyerId", "fullName businessName country city")
      .populate("driverId", "fullName businessName country city phone")
      .populate("vehicleId", "makeModel vehicleType plateNumberMasked capacityTons")
      .sort({ createdAt: -1 });

    res.json(shipments);
  } catch (err) {
    next(err);
  }
}

export async function createShipment(req, res, next) {
  try {
    const {
      conversationId,
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
    } = req.body;

    if (!buyerId || !driverId || !cargoDescription || !cargoWeightTons || !borderCrossing) {
      return res.status(400).json({ error: "Missing required shipment booking parameters" });
    }

    const trackingNumber = `BG-TRK-${crypto.randomBytes(3).toString("hex").toUpperCase()}-${new Date().getFullYear()}`;

    const shipment = await Shipment.create({
      trackingNumber,
      conversationId: conversationId || null,
      exporterId: req.user._id,
      buyerId,
      driverId,
      vehicleId: vehicleId || null,
      cargoDescription: cargoDescription.trim(),
      cargoWeightTons: Number(cargoWeightTons),
      pickupLocation: pickupLocation || "Quetta Logistics Mandi",
      borderCrossing,
      destinationLocation: destinationLocation || "Kandahar Central",
      status: "booked",
      lastCheckpoint: pickupLocation || "Quetta Mandi",
      scheduledPickupDate: scheduledPickupDate || null,
      estimatedDeliveryDate: estimatedDeliveryDate || null,
    });

    const populated = await Shipment.findById(shipment._id)
      .populate("exporterId", "fullName businessName country city")
      .populate("buyerId", "fullName businessName country city")
      .populate("driverId", "fullName businessName country city phone");

    res.status(201).json(populated);
  } catch (err) {
    next(err);
  }
}

export async function updateLocation(req, res, next) {
  try {
    const { shipmentId, checkpoint, status, latitude, longitude } = req.body;
    if (!shipmentId) {
      return res.status(400).json({ error: "shipmentId is required" });
    }

    const shipment = await Shipment.findById(shipmentId);
    if (!shipment) {
      return res.status(404).json({ error: "Shipment not found" });
    }

    const userIdStr = req.user._id.toString();
    const isParticipant =
      shipment.driverId.toString() === userIdStr ||
      shipment.exporterId.toString() === userIdStr ||
      req.user.role === "admin";

    if (!isParticipant) {
      return res.status(403).json({ error: "Unauthorized to update this shipment's coordinates" });
    }

    if (checkpoint) shipment.lastCheckpoint = checkpoint;
    if (status) shipment.status = status;
    if (latitude != null) shipment.currentLatitude = Number(latitude);
    if (longitude != null) shipment.currentLongitude = Number(longitude);
    shipment.lastLocationUpdate = new Date();
    shipment.locationSharingActive = true;

    await shipment.save();

    res.json({ success: true, shipment });
  } catch (err) {
    next(err);
  }
}
