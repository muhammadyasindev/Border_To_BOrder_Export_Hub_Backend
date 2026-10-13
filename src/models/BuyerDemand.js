import mongoose from "mongoose";

const buyerDemandSchema = new mongoose.Schema(
  {
    buyerId: {
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
    specifications: {
      type: String,
      required: true,
    },
    quantityRequired: {
      type: Number,
      required: true,
    },
    unit: {
      type: String,
      required: true,
      default: "Metric Tons",
    },
    targetPrice: {
      type: Number,
      default: null,
    },
    currency: {
      type: String,
      required: true,
      default: "USD",
    },
    preferredOrigin: {
      type: String,
      default: "Any",
    },
    destinationCountry: {
      type: String,
      required: true,
      index: true,
    },
    destinationCity: {
      type: String,
      required: true,
    },
    deliveryDeadline: {
      type: String,
      default: null,
    },
    packagingRequirements: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      required: true,
      enum: ["active", "fulfilled", "closed"],
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

buyerDemandSchema.index({ title: "text", specifications: "text" });

export default mongoose.model("BuyerDemand", buyerDemandSchema);
