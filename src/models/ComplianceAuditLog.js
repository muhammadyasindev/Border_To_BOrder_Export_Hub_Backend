import mongoose from "mongoose";

const complianceAuditLogSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    caseReference: {
      type: String,
      required: true,
    },
    justification: {
      type: String,
      required: true,
    },
    authorizedBy: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      default: "inspection_access",
    },
    ipAddress: {
      type: String,
      default: null,
    },
    grantTokenHash: {
      type: String,
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
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

export default mongoose.model("ComplianceAuditLog", complianceAuditLogSchema);
