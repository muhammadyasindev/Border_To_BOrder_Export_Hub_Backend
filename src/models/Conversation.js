import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    dealSubjectType: {
      type: String,
      default: "general",
      enum: ["general", "product", "product_offer", "demand", "transport", "transport_request", "deal"],
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    productOfferId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductOffer",
      default: null,
    },
    demandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BuyerDemand",
      default: null,
    },
    transportOfferId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TransportOffer",
      default: null,
    },
    transportRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TransportRequest",
      default: null,
    },
    dealStatus: {
      type: String,
      required: true,
      default: "inquiry",
      enum: [
        "inquiry",
        "pending",
        "negotiating",
        "quotation_exchanged",
        "terms_agreed",
        "awaiting_confirmation",
        "confirmed",
        "rejected",
        "transporter_invited",
        "booked",
        "in_transit",
        "completed",
        "cancelled",
      ],
      index: true,
    },
    agreedPrice: {
      type: Number,
      default: null,
    },
    agreedQuantity: {
      type: Number,
      default: null,
    },
    currency: {
      type: String,
      default: "USD",
    },
    currentProposal: {
      proposerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      price: { type: Number, default: null },
      quantity: { type: Number, default: null },
      currency: { type: String, default: "USD" },
      deliveryDate: { type: String, default: null },
      route: { type: String, default: null },
      paymentTerms: { type: String, default: null },
      status: {
        type: String,
        enum: [
          "pending",
          "negotiating",
          "awaiting_confirmation",
          "accepted",
          "confirmed",
          "rejected",
          "countered",
          "cancelled",
        ],
        default: "pending",
      },
      confirmations: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      updatedAt: { type: Date, default: Date.now },
    },
    proposalHistory: [
      {
        proposerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        price: Number,
        quantity: Number,
        currency: String,
        deliveryDate: String,
        route: String,
        paymentTerms: String,
        status: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    confirmationHistory: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        role: String,
        action: {
          type: String,
          enum: ["proposed", "countered", "accepted", "confirmed", "rejected", "cancelled"],
        },
        proposalSnapshot: Object,
        timestamp: { type: Date, default: Date.now },
        note: String,
      },
    ],
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

export default mongoose.model("Conversation", conversationSchema);
