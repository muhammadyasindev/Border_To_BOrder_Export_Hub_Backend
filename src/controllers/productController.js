import Product from "../models/Product.js";
import ProductOffer from "../models/ProductOffer.js";

// 1. Get Products with Advanced Filters & Sorting
export async function getProducts(req, res, next) {
  try {
    const {
      category,
      originCountry,
      search,
      status = "active",
      myOnly,
      minPrice,
      maxPrice,
      minQty,
      sortBy = "createdAt",
      sortOrder = "desc",
      limit = 50,
      skip = 0,
    } = req.query;

    const filter = {};

    // If myOnly is requested, filter by current user
    if (myOnly === "true") {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required for my products" });
      }
      filter.exporterId = req.user._id;
      if (req.query.status && req.query.status !== "all") {
        filter.status = req.query.status;
      }
    } else {
      // Public marketplace: only show active products with available stock
      filter.status = "active";
      filter.quantityAvailable = { $gt: 0 };
    }

    if (category && category !== "All") filter.category = category;
    if (originCountry && originCountry !== "All") filter.originCountry = originCountry;

    if (minPrice || maxPrice) {
      filter.pricePerUnit = {};
      if (minPrice) filter.pricePerUnit.$gte = Number(minPrice);
      if (maxPrice) filter.pricePerUnit.$lte = Number(maxPrice);
    }

    if (minQty) {
      filter.quantityAvailable = { $gte: Number(minQty) };
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { originCity: { $regex: search, $options: "i" } },
        { originCountry: { $regex: search, $options: "i" } },
      ];
    }

    const sortObj = {};
    sortObj[sortBy] = sortOrder === "asc" ? 1 : -1;

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate("exporterId", "fullName businessName country city verificationStatus avatarUrl phone")
        .sort(sortObj)
        .limit(parseInt(limit, 10))
        .skip(parseInt(skip, 10)),
      Product.countDocuments(filter),
    ]);

    // Attach active promotional offer to each product if exists
    const productIds = products.map((p) => p._id);
    const activeOffers = await ProductOffer.find({
      productId: { $in: productIds },
      status: "active",
      validUntil: { $gt: new Date() },
    });

    const offerMap = new Map();
    activeOffers.forEach((o) => {
      offerMap.set(o.productId.toString(), o);
    });

    const productsWithOffers = products.map((p) => {
      const obj = p.toJSON();
      obj.activeOffer = offerMap.get(p._id.toString()) || null;
      return obj;
    });

    res.json({
      products: productsWithOffers,
      total,
      limit: parseInt(limit, 10),
      skip: parseInt(skip, 10),
    });
  } catch (err) {
    next(err);
  }
}

// 2. Get Product By ID
export async function getProductById(req, res, next) {
  try {
    const product = await Product.findById(req.params.id).populate(
      "exporterId",
      "fullName businessName country city verificationStatus avatarUrl phone"
    );
    if (!product) return res.status(404).json({ error: "Product listing not found" });

    // Fetch active promotional offers
    const offers = await ProductOffer.find({
      productId: product._id,
      status: "active",
    }).sort({ createdAt: -1 });

    const result = product.toJSON();
    result.offers = offers;
    result.activeOffer = offers.find((o) => new Date(o.validUntil) > new Date()) || null;

    res.json(result);
  } catch (err) {
    next(err);
  }
}

// 3. Create Product (Exporter Only)
export async function createProduct(req, res, next) {
  try {
    if (req.user.role !== "exporter" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Only registered exporters can publish product listings" });
    }

    const {
      title,
      category,
      description,
      qualityGrade,
      quantityAvailable,
      unit,
      pricePerUnit,
      currency,
      originCountry,
      originCity,
      destinationMarkets,
      destinationCorridors,
      minOrderQuantity,
      deliveryTerms,
      availability,
      imageUrl,
      images,
    } = req.body;

    const prodTitle = (title || req.body.name || req.body.productName || "").trim();
    const qty = quantityAvailable != null ? Number(quantityAvailable) : (req.body.quantity != null ? Number(req.body.quantity) : null);
    const price = pricePerUnit != null ? Number(pricePerUnit) : (req.body.price != null ? Number(req.body.price) : null);

    if (!prodTitle || !category || !description || qty == null || price == null) {
      return res.status(400).json({ error: "Missing required product fields (title, category, description, quantity, price)" });
    }

    const product = await Product.create({
      exporterId: req.user._id,
      title: prodTitle,
      category,
      description: description.trim(),
      qualityGrade: qualityGrade || "Grade A",
      quantityAvailable: qty,
      unit: unit || "Metric Tons",
      pricePerUnit: price,
      currency: currency || "USD",
      minOrderQuantity: Number(minOrderQuantity) || 1,
      deliveryTerms: deliveryTerms || "FOB / Border Zero-Point",
      availability: availability || "In Stock / Ready for Dispatch",
      originCountry: originCountry || req.user.country || "Pakistan",
      originCity: originCity || req.user.city || "Quetta",
      destinationMarkets: destinationMarkets || "",
      destinationCorridors: destinationCorridors || "Pakistan, Iran, Afghanistan, China",
      imageUrl: imageUrl || null,
      images: Array.isArray(images) ? images : imageUrl ? [imageUrl] : [],
      status: "active",
    });

    const populated = await Product.findById(product._id).populate(
      "exporterId",
      "fullName businessName country city verificationStatus avatarUrl phone"
    );

    const json = populated.toJSON();
    res.status(201).json({ product: populated, ...json });
  } catch (err) {
    next(err);
  }
}

// 4. Update Product (Owner or Admin)
export async function updateProduct(req, res, next) {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Role-based permission check: only owner or admin can edit
    if (product.exporterId.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ error: "Access denied. You can only edit your own products." });
    }

    const allowedFields = [
      "title",
      "category",
      "description",
      "qualityGrade",
      "quantityAvailable",
      "unit",
      "pricePerUnit",
      "currency",
      "minOrderQuantity",
      "deliveryTerms",
      "availability",
      "originCountry",
      "originCity",
      "destinationMarkets",
      "destinationCorridors",
      "imageUrl",
      "images",
      "status",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === "quantityAvailable" || field === "pricePerUnit" || field === "minOrderQuantity") {
          product[field] = Number(req.body[field]);
        } else {
          product[field] = req.body[field];
        }
      }
    });

    await product.save();

    const populated = await Product.findById(product._id).populate(
      "exporterId",
      "fullName businessName country city verificationStatus avatarUrl phone"
    );

    res.json(populated);
  } catch (err) {
    next(err);
  }
}

// 5. Update Product Status (Pause / Publish / Close)
export async function updateProductStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["active", "paused", "closed"].includes(status)) {
      return res.status(400).json({ error: "Invalid status. Allowed: active, paused, closed" });
    }

    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ error: "Product not found" });

    if (product.exporterId.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized to change status of this product" });
    }

    product.status = status;
    await product.save();

    res.json({ success: true, product });
  } catch (err) {
    next(err);
  }
}

// 6. Delete Product
export async function deleteProduct(req, res, next) {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);

    if (!product) return res.status(404).json({ error: "Product not found" });

    if (product.exporterId.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized to delete this product" });
    }

    await Product.findByIdAndDelete(id);
    await ProductOffer.deleteMany({ productId: id });

    res.json({ success: true, message: "Product and associated offers deleted successfully" });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// PROMOTIONAL PRODUCT OFFERS (Requirement 1 & 6)
// ==========================================

// 7. Create Promotional Offer for Product
export async function createProductOffer(req, res, next) {
  try {
    const { id: productId } = req.params;
    const product = await Product.findById(productId);

    if (!product) return res.status(404).json({ error: "Target product not found" });

    if (product.exporterId.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ error: "Only the product owner can create promotional offers" });
    }

    const {
      title,
      discountType = "percentage",
      discountValue,
      validUntil,
      minQuantity = 1,
      terms,
    } = req.body;

    const offerTitle = (title || `${product.title} - ${discountValue}${discountType === "percentage" ? "%" : " " + product.currency} Promotional Offer`).trim();

    if (discountValue == null || !validUntil) {
      return res.status(400).json({ error: "discountValue and validUntil expiry date are required" });
    }

    const numDiscount = Number(discountValue);
    if (numDiscount <= 0) {
      return res.status(400).json({ error: "Discount value must be greater than 0" });
    }

    let calculatedOfferPrice = 0;
    if (discountType === "percentage") {
      if (numDiscount >= 100) {
        return res.status(400).json({ error: "Percentage discount cannot be 100% or greater" });
      }
      calculatedOfferPrice = Math.round(product.pricePerUnit * (1 - numDiscount / 100));
    } else {
      if (numDiscount >= product.pricePerUnit) {
        return res.status(400).json({ error: "Fixed discount cannot exceed original product price" });
      }
      calculatedOfferPrice = Math.round(product.pricePerUnit - numDiscount);
    }

    if (calculatedOfferPrice <= 0) {
      return res.status(400).json({ error: "Calculated offer price must be positive" });
    }

    const expiryDate = new Date(validUntil);
    if (isNaN(expiryDate.getTime()) || expiryDate <= new Date()) {
      return res.status(400).json({ error: "Offer validity period must be a valid future date" });
    }

    const offer = await ProductOffer.create({
      productId: product._id,
      exporterId: req.user._id,
      title: offerTitle,
      discountType,
      discountValue: numDiscount,
      originalPrice: product.pricePerUnit,
      offerPrice: calculatedOfferPrice,
      currency: product.currency,
      minQuantity: Number(minQuantity) || 1,
      validUntil: expiryDate,
      terms: terms || "Special promotional corridor pricing.",
      status: "active",
    });

    const populated = await ProductOffer.findById(offer._id)
      .populate("productId", "title category pricePerUnit currency imageUrl originCountry originCity")
      .populate("exporterId", "fullName businessName country city verificationStatus avatarUrl");

    const json = populated.toJSON();
    res.status(201).json({ offer: populated, ...json });
  } catch (err) {
    next(err);
  }
}

// 8. Get All Active Promotional Offers Across Marketplace
export async function getAllProductOffers(req, res, next) {
  try {
    const { country, category, search, myOnly } = req.query;
    const filter = {};

    if (myOnly === "true") {
      if (!req.user) return res.status(401).json({ error: "Auth required" });
      filter.exporterId = req.user._id;
    } else {
      filter.status = "active";
      filter.validUntil = { $gt: new Date() };
    }

    const offers = await ProductOffer.find(filter)
      .populate("productId", "title category pricePerUnit currency imageUrl originCountry originCity unit quantityAvailable")
      .populate("exporterId", "fullName businessName country city verificationStatus avatarUrl phone")
      .sort({ createdAt: -1 });

    // In-memory filter for populated product fields if query specified
    let filtered = offers;
    if (myOnly !== "true") {
      filtered = filtered.filter((o) => o.productId && (o.productId.quantityAvailable == null || o.productId.quantityAvailable > 0));
    }
    if (category && category !== "All") {
      filtered = filtered.filter((o) => o.productId?.category === category);
    }
    if (country && country !== "All") {
      filtered = filtered.filter((o) => o.productId?.originCountry === country);
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (o) =>
          o.title?.toLowerCase().includes(q) ||
          o.productId?.title?.toLowerCase().includes(q) ||
          o.exporterId?.businessName?.toLowerCase().includes(q)
      );
    }

    res.json(filtered);
  } catch (err) {
    next(err);
  }
}

// 9. Update Promotional Offer Status (Pause / Resume)
export async function updateProductOfferStatus(req, res, next) {
  try {
    const { offerId } = req.params;
    const { status } = req.body;

    const offer = await ProductOffer.findById(offerId);
    if (!offer) return res.status(404).json({ error: "Offer not found" });

    if (offer.exporterId.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized to update this offer" });
    }

    offer.status = status;
    await offer.save();

    res.json({ success: true, offer });
  } catch (err) {
    next(err);
  }
}

// 10. Delete Promotional Offer
export async function deleteProductOffer(req, res, next) {
  try {
    const { offerId } = req.params;
    const offer = await ProductOffer.findById(offerId);
    if (!offer) return res.status(404).json({ error: "Offer not found" });

    if (offer.exporterId.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized to delete this offer" });
    }

    await ProductOffer.findByIdAndDelete(offerId);
    res.json({ success: true, message: "Promotional offer deleted" });
  } catch (err) {
    next(err);
  }
}
