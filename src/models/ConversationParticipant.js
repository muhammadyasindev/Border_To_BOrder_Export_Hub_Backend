import mongoose from "mongoose";

const conversationParticipantSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    roleInDeal: {
      type: String,
      required: true,
      enum: ["exporter", "buyer", "transporter", "admin"],
    },
    joinedAt: {
      type: Date,
      default: Date.now,
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

conversationParticipantSchema.index({ conversationId: 1, userId: 1 }, { unique: true });

export default mongoose.model("ConversationParticipant", conversationParticipantSchema);
