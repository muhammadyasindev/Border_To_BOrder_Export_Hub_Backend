import mongoose from "mongoose";

const shipmentSchema = new mongoose.Schema(
  {
    trackingNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      default: null,
    },
    exporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
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
    cargoDescription: {
      type: String,
      required: true,
    },
    cargoWeightTons: {
      type: Number,
      required: true,
    },
    pickupLocation: {
      type: String,
      required: true,
    },
    borderCrossing: {
      type: String,
      required: true,
    },
    destinationLocation: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
      default: "booked",
      enum: [
        "booked",
        "pickup_pending",
        "in_transit_to_border",
        "border_clearance",
        "crossed_border",
        "in_transit_to_destination",
        "delivered",
        "cancelled",
      ],
      index: true,
    },
    currentLatitude: {
      type: Number,
      default: null,
    },
    currentLongitude: {
      type: Number,
      default: null,
    },
    locationSharingActive: {
      type: Boolean,
      default: false,
    },
    lastCheckpoint: {
      type: String,
      default: "Pickup Location",
    },
    lastLocationUpdate: {
      type: Date,
      default: null,
    },
    scheduledPickupDate: {
      type: String,
      default: null,
    },
    estimatedDeliveryDate: {
      type: String,
      default: null,
    },
    actualDeliveryDate: {
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

export default mongoose.model("Shipment", shipmentSchema);
