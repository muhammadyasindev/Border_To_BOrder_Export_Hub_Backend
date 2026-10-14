import mongoose from "mongoose";

const contactInquirySchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 150,
    },
    cityOrAddress: {
      type: String,
      required: true,
      trim: true,
      maxlength: 250,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 250,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000,
    },
    ipAddress: {
      type: String,
      default: "",
    },
    userAgent: {
      type: String,
      default: "",
    },
    whatsappRecipient: {
      type: String,
      default: "923324042186",
    },
    whatsappStatus: {
      type: String,
      enum: ["sent", "pending_credentials", "failed"],
      default: "pending_credentials",
    },
    whatsappMessageId: {
      type: String,
      default: null,
    },
    whatsappError: {
      type: String,
      default: null,
    },
    submissionHash: {
      type: String,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const ContactInquiry = mongoose.model("ContactInquiry", contactInquirySchema);
export default ContactInquiry;
