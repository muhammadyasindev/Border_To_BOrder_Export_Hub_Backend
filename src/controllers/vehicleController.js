import Vehicle from "../models/Vehicle.js";

export async function getVehicles(req, res, next) {
  try {
    const { driverId, vehicleType, isAvailable, limit = 50 } = req.query;
    const filter = {};

    if (driverId) filter.driverId = driverId;
    if (vehicleType && vehicleType !== "All") filter.vehicleType = vehicleType;
    if (isAvailable !== undefined) filter.isAvailable = isAvailable === "true";

    const vehicles = await Vehicle.find(filter)
      .populate("driverId", "fullName businessName country city verificationStatus avatarUrl phone")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10));

    // Mask plate number if caller is not the driver
    const currentUserId = req.user ? req.user._id.toString() : null;
    const sanitized = vehicles.map((v) => {
      const obj = v.toJSON();
      if (currentUserId && v.driverId && v.driverId._id.toString() === currentUserId) {
        return obj;
      }
      return {
        ...obj,
        plateNumberFull: obj.plateNumberMasked,
      };
    });

    res.json(sanitized);
  } catch (err) {
    next(err);
  }
}

export async function createVehicle(req, res, next) {
  try {
    const {
      vehicleType,
      makeModel,
      registrationCountry,
      plateNumber,
      capacityTons,
      supportedCargo,
      supportedCorridors,
    } = req.body;

    if (!vehicleType || !makeModel || !plateNumber || !capacityTons) {
      return res.status(400).json({ error: "Missing required vehicle registration fields" });
    }

    const cleanPlate = plateNumber.trim();
    const plateNumberMasked =
      cleanPlate.length > 4
        ? `${cleanPlate.slice(0, 2)}-***-${cleanPlate.slice(-4)}`
        : `***-${cleanPlate}`;

    const vehicle = await Vehicle.create({
      driverId: req.user._id,
      vehicleType,
      makeModel: makeModel.trim(),
      registrationCountry: registrationCountry || req.user.country || "Pakistan",
      plateNumberMasked,
      plateNumberFull: cleanPlate,
      capacityTons: Number(capacityTons),
      supportedCargo: supportedCargo || "General Freight",
      supportedCorridors: supportedCorridors || "Taftan-Mirjaveh",
      isAvailable: true,
      verificationStatus: "pending_review",
    });

    const populated = await Vehicle.findById(vehicle._id).populate(
      "driverId",
      "fullName businessName country city verificationStatus avatarUrl phone"
    );

    res.status(201).json(populated);
  } catch (err) {
    next(err);
  }
}
