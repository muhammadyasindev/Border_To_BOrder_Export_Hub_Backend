import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    senderRole: {
      type: String,
      default: null,
    },
    content: {
      type: String,
      required: true,
    },
    messageType: {
      type: String,
      enum: ["chat", "quotation", "counteroffer", "acceptance", "confirmation", "rejection", "deal_status_change"],
      default: "chat",
      index: true,
    },
    proposalData: {
      price: Number,
      quantity: Number,
      currency: String,
      route: String,
      deliveryDate: String,
      paymentTerms: String,
      action: String,
    },
    attachmentName: {
      type: String,
      default: null,
    },
    attachmentUrl: {
      type: String,
      default: null,
    },
    attachmentType: {
      type: String,
      default: null,
    },
    attachments: [
      {
        name: String,
        url: String,
        type: String,
        size: String,
      },
    ],
    voiceDuration: {
      type: Number,
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

messageSchema.index({ conversationId: 1, createdAt: 1 });

export default mongoose.model("Message", messageSchema);
