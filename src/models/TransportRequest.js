import mongoose from "mongoose";

const transportRequestSchema = new mongoose.Schema(
  {
    requesterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    requesterRole: {
      type: String,
      required: true,
      enum: ["importer", "exporter"],
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    cargoDescription: {
      type: String,
      required: true,
    },
    cargoCategory: {
      type: String,
      required: true,
      default: "Agricultural",
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0.1,
    },
    unit: {
      type: String,
      required: true,
      default: "Metric Tons",
    },
    weightTons: {
      type: Number,
      default: null,
    },
    volumeCbm: {
      type: Number,
      default: null,
    },
    pickupCountry: {
      type: String,
      required: true,
      index: true,
    },
    pickupCity: {
      type: String,
      required: true,
    },
    pickupLocation: {
      type: String,
      default: "",
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
    destinationLocation: {
      type: String,
      default: "",
    },
    preferredRoute: {
      type: String,
      default: "",
    },
    pickupDate: {
      type: Date,
      default: null,
    },
    deliveryDeadline: {
      type: Date,
      default: null,
    },
    vehicleRequirements: {
      type: String,
      default: "Flatbed / Heavy Articulated Truck",
    },
    offeredBudget: {
      type: Number,
      default: null,
    },
    currency: {
      type: String,
      required: true,
      default: "USD",
    },
    specialHandling: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      required: true,
      enum: ["active", "quoted", "booked", "paused", "cancelled"],
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

transportRequestSchema.index({ status: 1, pickupCountry: 1, destinationCountry: 1 });
transportRequestSchema.index({ title: "text", cargoDescription: "text" });

export default mongoose.model("TransportRequest", transportRequestSchema);
