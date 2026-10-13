import Product from "../models/Product.js";

export async function getProducts(req, res, next) {
  try {
    const { category, originCountry, search, status = "active", limit = 50, skip = 0 } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (category && category !== "All") filter.category = category;
    if (originCountry && originCountry !== "All") filter.originCountry = originCountry;

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { originCity: { $regex: search, $options: "i" } },
      ];
    }

    const products = await Product.find(filter)
      .populate("exporterId", "fullName businessName country city verificationStatus avatarUrl")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10))
      .skip(parseInt(skip, 10));

    res.json(products);
  } catch (err) {
    next(err);
  }
}

export async function getProductById(req, res, next) {
  try {
    const product = await Product.findById(req.params.id).populate(
      "exporterId",
      "fullName businessName country city verificationStatus avatarUrl"
    );
    if (!product) return res.status(404).json({ error: "Product listing not found" });
    res.json(product);
  } catch (err) {
    next(err);
  }
}

export async function createProduct(req, res, next) {
  try {
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
      imageUrl,
    } = req.body;

    if (!title || !category || !description || quantityAvailable == null || pricePerUnit == null) {
      return res.status(400).json({ error: "Missing required product fields" });
    }

    const product = await Product.create({
      exporterId: req.user._id,
      title: title.trim(),
      category,
      description: description.trim(),
      qualityGrade: qualityGrade || "Grade A",
      quantityAvailable: Number(quantityAvailable),
      unit: unit || "Metric Tons",
      pricePerUnit: Number(pricePerUnit),
      currency: currency || "USD",
      originCountry: originCountry || req.user.country || "Pakistan",
      originCity: originCity || req.user.city || "Quetta",
      destinationMarkets: destinationMarkets || "",
      imageUrl: imageUrl || null,
      status: "active",
    });

    const populated = await Product.findById(product._id).populate(
      "exporterId",
      "fullName businessName country city verificationStatus avatarUrl"
    );

    res.status(201).json(populated);
  } catch (err) {
    next(err);
  }
}
