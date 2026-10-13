import mongoose from "mongoose";

const transportOfferSchema = new mongoose.Schema(
  {
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
      default: null,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    originCorridor: {
      type: String,
      required: true,
      index: true,
    },
    destinationCorridor: {
      type: String,
      required: true,
      index: true,
    },
    availableCapacityTons: {
      type: Number,
      required: true,
    },
    cargoCategory: {
      type: String,
      required: true,
    },
    ratePerKmOrTrip: {
      type: Number,
      required: true,
    },
    pricingUnit: {
      type: String,
      default: "Per Trip",
    },
    currency: {
      type: String,
      default: "USD",
    },
    availableFrom: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      default: "active",
      enum: ["active", "booked", "paused"],
      index: true,
    },
    specialConditions: {
      type: String,
      default: null,
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

export default mongoose.model("TransportOffer", transportOfferSchema);
