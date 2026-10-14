import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    exporterId: {
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
      index: true,
    },
    description: {
      type: String,
      required: true,
    },
    qualityGrade: {
      type: String,
      default: "Grade A",
    },
    quantityAvailable: {
      type: Number,
      required: true,
    },
    unit: {
      type: String,
      required: true,
      default: "Metric Tons",
    },
    pricePerUnit: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      required: true,
      default: "USD",
    },
    originCountry: {
      type: String,
      required: true,
      index: true,
    },
    originCity: {
      type: String,
      required: true,
    },
    destinationMarkets: {
      type: String,
      default: "",
    },
    destinationCorridors: {
      type: mongoose.Schema.Types.Mixed,
      default: "Pakistan, Iran, Afghanistan, China",
    },
    minOrderQuantity: {
      type: Number,
      default: 1,
      min: 1,
    },
    deliveryTerms: {
      type: String,
      default: "FOB / Border Zero-Point",
    },
    availability: {
      type: String,
      default: "In Stock / Ready for Dispatch",
    },
    imageUrl: {
      type: String,
      default: null,
    },
    images: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      required: true,
      enum: ["active", "paused", "closed"],
      default: "active",
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

productSchema.index({ title: "text", description: "text" });

export default mongoose.model("Product", productSchema);
