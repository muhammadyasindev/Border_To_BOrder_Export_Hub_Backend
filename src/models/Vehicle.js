import mongoose from "mongoose";

const vehicleSchema = new mongoose.Schema(
  {
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    vehicleType: {
      type: String,
      required: true,
    },
    makeModel: {
      type: String,
      required: true,
    },
    registrationCountry: {
      type: String,
      required: true,
      enum: ["Pakistan", "Iran", "Afghanistan"],
    },
    plateNumberMasked: {
      type: String,
      required: true,
    },
    plateNumberFull: {
      type: String,
      required: true,
    },
    capacityTons: {
      type: Number,
      required: true,
    },
    supportedCargo: {
      type: String,
      required: true,
    },
    supportedCorridors: {
      type: String,
      required: true,
    },
    isAvailable: {
      type: Boolean,
      default: true,
      index: true,
    },
    verificationStatus: {
      type: String,
      default: "pending_review",
      enum: ["pending_review", "verified", "rejected"],
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

export default mongoose.model("Vehicle", vehicleSchema);
