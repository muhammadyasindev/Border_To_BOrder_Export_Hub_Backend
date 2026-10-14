import BuyerDemand from "../models/BuyerDemand.js";

// 1. Get Buyer Demands with Filters & Sorting
export async function getDemands(req, res, next) {
  try {
    const {
      category,
      destinationCountry,
      search,
      status = "active",
      myOnly,
      minPrice,
      maxPrice,
      sortBy = "createdAt",
      sortOrder = "desc",
      limit = 50,
      skip = 0,
    } = req.query;

    const filter = {};

    if (myOnly === "true") {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required for my demands" });
      }
      filter.buyerId = req.user._id;
      if (req.query.status && req.query.status !== "all") {
        filter.status = req.query.status;
      }
    } else {
      filter.status = "active";
      filter.quantityRequired = { $gt: 0 };
    }

    if (category && category !== "All") filter.category = category;
    if (destinationCountry && destinationCountry !== "All") filter.destinationCountry = destinationCountry;

    if (minPrice || maxPrice) {
      filter.targetPrice = {};
      if (minPrice) filter.targetPrice.$gte = Number(minPrice);
      if (maxPrice) filter.targetPrice.$lte = Number(maxPrice);
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { specifications: { $regex: search, $options: "i" } },
        { destinationCity: { $regex: search, $options: "i" } },
        { destinationCountry: { $regex: search, $options: "i" } },
      ];
    }

    const sortObj = {};
    sortObj[sortBy] = sortOrder === "asc" ? 1 : -1;

    const [demands, total] = await Promise.all([
      BuyerDemand.find(filter)
        .populate("buyerId", "fullName businessName country city verificationStatus avatarUrl phone")
        .sort(sortObj)
        .limit(parseInt(limit, 10))
        .skip(parseInt(skip, 10)),
      BuyerDemand.countDocuments(filter),
    ]);

    res.json({
      demands,
      total,
      limit: parseInt(limit, 10),
      skip: parseInt(skip, 10),
    });
  } catch (err) {
    next(err);
  }
}

// 2. Get Demand By ID
export async function getDemandById(req, res, next) {
  try {
    const demand = await BuyerDemand.findById(req.params.id).populate(
      "buyerId",
      "fullName businessName country city verificationStatus avatarUrl phone"
    );
    if (!demand) return res.status(404).json({ error: "Buyer demand not found" });
    res.json(demand);
  } catch (err) {
    next(err);
  }
}

// 3. Create Demand (Importer Only)
export async function createDemand(req, res, next) {
  try {
    if (req.user.role !== "importer" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Only registered importers can publish buyer demands" });
    }

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
      preferredCorridor,
      requiredDeliveryDate,
      deliveryDeadline,
      packagingRequirements,
      additionalRequirements,
    } = req.body;

    const demandTitle = (title || req.body.productName || req.body.requiredProduct || "").trim();
    const qty = quantityRequired != null ? Number(quantityRequired) : (req.body.quantity != null ? Number(req.body.quantity) : null);

    if (!demandTitle || !category || !specifications || qty == null) {
      return res.status(400).json({ error: "Missing required demand fields (title, category, specifications, quantity)" });
    }

    const demand = await BuyerDemand.create({
      buyerId: req.user._id,
      title: demandTitle,
      category,
      specifications: specifications.trim(),
      quantityRequired: qty,
      unit: unit || "Metric Tons",
      targetPrice: targetPrice != null && targetPrice !== "" ? Number(targetPrice) : null,
      currency: currency || "USD",
      preferredOrigin: preferredOrigin || "Any",
      destinationCountry: destinationCountry || req.user.country || "Pakistan",
      destinationCity: destinationCity || req.user.city || "Quetta",
      preferredCorridor: preferredCorridor || "",
      requiredDeliveryDate: requiredDeliveryDate ? new Date(requiredDeliveryDate) : null,
      deliveryDeadline: deliveryDeadline || null,
      packagingRequirements: packagingRequirements || null,
      additionalRequirements: additionalRequirements || "",
      status: "active",
    });

    const populated = await BuyerDemand.findById(demand._id).populate(
      "buyerId",
      "fullName businessName country city verificationStatus avatarUrl phone"
    );

    const json = populated.toJSON();
    res.status(201).json({ demand: populated, ...json });
  } catch (err) {
    next(err);
  }
}

// 4. Update Demand (Owner or Admin)
export async function updateDemand(req, res, next) {
  try {
    const { id } = req.params;
    const demand = await BuyerDemand.findById(id);

    if (!demand) return res.status(404).json({ error: "Demand not found" });

    if (demand.buyerId.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ error: "Access denied. You can only edit your own demands." });
    }

    const allowedFields = [
      "title",
      "category",
      "specifications",
      "quantityRequired",
      "unit",
      "targetPrice",
      "currency",
      "preferredOrigin",
      "destinationCountry",
      "destinationCity",
      "preferredCorridor",
      "requiredDeliveryDate",
      "deliveryDeadline",
      "packagingRequirements",
      "additionalRequirements",
      "status",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === "quantityRequired") {
          demand[field] = Number(req.body[field]);
        } else if (field === "targetPrice") {
          demand[field] = req.body[field] ? Number(req.body[field]) : null;
        } else {
          demand[field] = req.body[field];
        }
      }
    });

    await demand.save();

    const populated = await BuyerDemand.findById(demand._id).populate(
      "buyerId",
      "fullName businessName country city verificationStatus avatarUrl phone"
    );

    res.json(populated);
  } catch (err) {
    next(err);
  }
}

// 5. Update Demand Status (Pause / Resume / Fulfill / Close)
export async function updateDemandStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["active", "paused", "fulfilled", "closed"].includes(status)) {
      return res.status(400).json({ error: "Invalid status. Allowed: active, paused, fulfilled, closed" });
    }

    const demand = await BuyerDemand.findById(id);
    if (!demand) return res.status(404).json({ error: "Demand not found" });

    if (demand.buyerId.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized to update status of this demand" });
    }

    demand.status = status;
    await demand.save();

    res.json({ success: true, demand });
  } catch (err) {
    next(err);
  }
}

// 6. Delete Demand
export async function deleteDemand(req, res, next) {
  try {
    const { id } = req.params;
    const demand = await BuyerDemand.findById(id);

    if (!demand) return res.status(404).json({ error: "Demand not found" });

    if (demand.buyerId.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized to delete this demand" });
    }

    await BuyerDemand.findByIdAndDelete(id);
    res.json({ success: true, message: "Buyer demand deleted successfully" });
  } catch (err) {
    next(err);
  }
}
