import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    businessName: {
      type: String,
      trim: true,
      default: null,
    },
    role: {
      type: String,
      required: true,
      enum: ["exporter", "importer", "driver", "admin"],
      index: true,
    },
    country: {
      type: String,
      required: true,
      default: "Pakistan",
    },
    city: {
      type: String,
      required: true,
      default: "Karachi",
    },
    phone: {
      type: String,
      default: null,
    },
    bio: {
      type: String,
      default: null,
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    cnicNumber: {
      type: String,
      default: null,
    },
    personAddress: {
      type: String,
      default: null,
    },
    businessAddress: {
      type: String,
      default: null,
    },
    drivingLicenseNumber: {
      type: String,
      default: null,
    },
    licenseExpiryDate: {
      type: String,
      default: null,
    },
    plateNumber: {
      type: String,
      default: null,
    },
    verificationStatus: {
      type: String,
      required: true,
      enum: ["not_submitted", "submitted", "pending_review", "changes_required", "verified", "rejected", "expired"],
      default: "not_submitted",
      index: true,
    },
    verificationNotes: {
      type: String,
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    sessionsRevokedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export default mongoose.model("User", userSchema);
