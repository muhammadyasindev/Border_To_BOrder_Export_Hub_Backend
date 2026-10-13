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
      enum: ["general", "product", "demand", "transport", "deal"],
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
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
    dealStatus: {
      type: String,
      required: true,
      default: "inquiry",
      enum: [
        "inquiry",
        "quotation_exchanged",
        "terms_agreed",
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
