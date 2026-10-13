import mongoose from "mongoose";

const newsReportSchema = new mongoose.Schema(
  {
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: ["border_crossing", "road_condition", "market_prices", "regulation_update"],
      index: true,
    },
    targetAudience: {
      type: String,
      default: "all",
      enum: ["all", "drivers", "exporters", "importers"],
    },
    locationCorridor: {
      type: String,
      required: true,
      index: true,
    },
    summary: {
      type: String,
      required: true,
    },
    details: {
      type: String,
      required: true,
    },
    sourceType: {
      type: String,
      default: "community_report",
      enum: ["official_source", "community_confirmed", "community_report"],
    },
    sourceName: {
      type: String,
      default: null,
    },
    priceDetails: {
      type: String,
      default: null,
    },
    waitingTimeHours: {
      type: Number,
      default: null,
    },
    status: {
      type: String,
      default: "published",
      enum: ["published", "under_review", "flagged"],
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret.__v;
        return ret;
      },
    },
  }
);

export default mongoose.model("NewsReport", newsReportSchema);
