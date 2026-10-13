import NewsReport from "../models/NewsReport.js";

export async function getNews(req, res, next) {
  try {
    const { category, corridor, audience } = req.query;

    const filter = { status: "published" };
    if (category) filter.category = category;
    if (corridor) filter.locationCorridor = { $regex: corridor, $options: "i" };
    if (audience && audience !== "all") filter.targetAudience = audience;

    const news = await NewsReport.find(filter)
      .populate("authorId", "fullName role businessName verificationStatus")
      .sort({ createdAt: -1 });

    const formatted = news.map((item) => {
      const doc = item.toJSON();
      const author = doc.authorId || {};
      return {
        ...doc,
        authorName: author.fullName || "Community Contributor",
        authorRole: author.role || "driver",
        authorBusiness: author.businessName || "",
        authorVerified: author.verificationStatus || "unverified",
      };
    });

    res.json({ news: formatted });
  } catch (err) {
    next(err);
  }
}

export async function createNews(req, res, next) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const {
      title,
      category,
      targetAudience,
      locationCorridor,
      summary,
      details,
      sourceType,
      sourceName,
      priceDetails,
      waitingTimeHours,
    } = req.body;

    if (!title || !category || !locationCorridor || !summary) {
      return res.status(400).json({ error: "Please fill in all mandatory news report fields" });
    }

    let safeSourceType = sourceType || "community_report";
    if (safeSourceType === "official_source" && user.role !== "admin") {
      safeSourceType = "community_report";
    }

    const newReport = await NewsReport.create({
      authorId: user._id,
      title: title.trim(),
      category,
      targetAudience: targetAudience || "all",
      locationCorridor: locationCorridor.trim(),
      summary: summary.trim(),
      details: details ? details.trim() : summary.trim(),
      sourceType: safeSourceType,
      sourceName: sourceName ? sourceName.trim() : user.businessName || user.fullName,
      priceDetails: priceDetails || null,
      waitingTimeHours: waitingTimeHours != null ? Number(waitingTimeHours) : null,
      status: "published",
    });

    res.status(201).json({ success: true, report: newReport });
  } catch (err) {
    next(err);
  }
}
