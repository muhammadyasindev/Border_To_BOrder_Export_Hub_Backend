import mongoose from "mongoose";

const verificationDocumentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    documentType: {
      type: String,
      required: true,
      enum: [
        "cnic_passport",
        "business_license",
        "tax_certificate",
        "driving_license",
        "vehicle_registration",
        "fitness_certificate",
      ],
    },
    documentNumber: {
      type: String,
      default: null,
    },
    fileName: {
      type: String,
      required: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    fileSize: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      required: true,
      enum: ["pending_review", "approved", "rejected", "changes_required"],
      default: "pending_review",
      index: true,
    },
    reviewerNotes: {
      type: String,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    reviewedAt: {
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
        delete ret.__v;
        return ret;
      },
    },
  }
);

export default mongoose.model("VerificationDocument", verificationDocumentSchema);
