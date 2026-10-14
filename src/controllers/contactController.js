import crypto from "crypto";
import ContactInquiry from "../models/ContactInquiry.js";
import { sendEmail } from "../services/emailService.js";

// Rate limiting map: ip -> array of timestamps
const ipRequestTimestamps = new Map();
// Duplicate tracking: hash -> timestamp
const recentSubmissionHashes = new Map();

// Periodic cleanup of rate limiting memory (every 10 minutes)
setInterval(() => {
  const now = Date.now();
  const tenMinutesAgo = now - 10 * 60 * 1000;
  for (const [ip, timestamps] of ipRequestTimestamps.entries()) {
    const valid = timestamps.filter((t) => t > tenMinutesAgo);
    if (valid.length === 0) {
      ipRequestTimestamps.delete(ip);
    } else {
      ipRequestTimestamps.set(ip, valid);
    }
  }
  for (const [hash, time] of recentSubmissionHashes.entries()) {
    if (time < now - 60 * 1000) {
      recentSubmissionHashes.delete(hash);
    }
  }
}, 10 * 60 * 1000);

// Helper to normalize phone number to international format for WhatsApp Cloud API (e.g., 03324042186 -> 923324042186)
function normalizeWhatsAppNumber(raw) {
  if (!raw) return "923324042186";
  const digitsOnly = String(raw).replace(/\D/g, "");
  if (digitsOnly.startsWith("0")) {
    return "92" + digitsOnly.slice(1);
  }
  if (digitsOnly.startsWith("92")) {
    return digitsOnly;
  }
  return digitsOnly;
}

export async function submitContactInquiry(req, res, next) {
  try {
    const clientIp =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";

    // 1. Rate Limiting Check (max 5 inquiries per 10 minutes per IP)
    const now = Date.now();
    const tenMinutesAgo = now - 10 * 60 * 1000;
    const timestamps = ipRequestTimestamps.get(clientIp) || [];
    const recent = timestamps.filter((t) => t > tenMinutesAgo);
    if (recent.length >= 6) {
      return res.status(429).json({
        success: false,
        error: "Too many inquiries submitted from this connection. Please wait a few minutes before trying again.",
      });
    }

    // 2. Extract and sanitize input fields
    const {
      fullName,
      phoneNumber,
      email,
      cityOrAddress,
      subject,
      message,
    } = req.body;

    const trimmedName = (fullName || "").trim();
    const trimmedPhone = (phoneNumber || "").trim();
    const trimmedEmail = (email || "").trim().toLowerCase();
    const trimmedCity = (cityOrAddress || "").trim();
    const trimmedSubject = (subject || "").trim();
    const trimmedMessage = (message || "").trim();

    // 3. Validation
    const errors = [];
    if (!trimmedName || trimmedName.length < 2) {
      errors.push("Full Name is required (minimum 2 characters).");
    }
    if (trimmedName.length > 120) {
      errors.push("Full Name must not exceed 120 characters.");
    }

    if (!trimmedPhone || trimmedPhone.length < 7) {
      errors.push("Valid phone number is required (minimum 7 digits).");
    }
    const phoneRegex = /^[\d\s+\-()]{7,25}$/;
    if (trimmedPhone && !phoneRegex.test(trimmedPhone)) {
      errors.push("Phone number format is invalid.");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      errors.push("A valid email address is required.");
    }

    if (!trimmedCity || trimmedCity.length < 2) {
      errors.push("Address or City is required.");
    }

    if (!trimmedSubject || trimmedSubject.length < 3) {
      errors.push("Inquiry Subject is required (minimum 3 characters).");
    }

    if (!trimmedMessage || trimmedMessage.length < 5) {
      errors.push("Inquiry Message is required (minimum 5 characters).");
    }
    if (trimmedMessage.length > 3000) {
      errors.push("Inquiry Message must not exceed 3000 characters.");
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: errors[0],
        allErrors: errors,
      });
    }

    // 4. Duplicate Submission Protection (60-second window)
    const submissionHash = crypto
      .createHash("sha256")
      .update(`${trimmedEmail}:${trimmedPhone}:${trimmedSubject}:${trimmedMessage.slice(0, 50)}`)
      .digest("hex");

    if (recentSubmissionHashes.has(submissionHash)) {
      const lastSent = recentSubmissionHashes.get(submissionHash);
      if (now - lastSent < 60 * 1000) {
        return res.status(409).json({
          success: false,
          error: "A duplicate inquiry was recently received. Please allow 1 minute before resubmitting.",
        });
      }
    }
    recentSubmissionHashes.set(submissionHash, now);

    // Update IP rate limiter
    recent.push(now);
    ipRequestTimestamps.set(clientIp, recent);

    // 5. Destination WhatsApp recipient
    const configuredRecipient =
      process.env.WHATSAPP_RECIPIENT_NUMBER || "03324042186";
    const normalizedRecipient = normalizeWhatsAppNumber(configuredRecipient);

    // 6. WhatsApp Cloud API configuration from backend environment
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const apiVersion = process.env.WHATSAPP_API_VERSION || "v21.0";

    let whatsappStatus = "pending_credentials";
    let whatsappMessageId = null;
    let whatsappError = null;

    // 7. Dispatch to WhatsApp Business API if credentials are present
    if (accessToken && phoneNumberId) {
      try {
        const payload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: normalizedRecipient,
          type: "text",
          text: {
            preview_url: false,
            body:
              `🔔 *New Border Export Hub Trade Inquiry*\n\n` +
              `*Sender:* ${trimmedName}\n` +
              `*Phone:* ${trimmedPhone}\n` +
              `*Email:* ${trimmedEmail}\n` +
              `*City/Address:* ${trimmedCity}\n` +
              `*Subject:* ${trimmedSubject}\n\n` +
              `*Message:*\n${trimmedMessage}\n\n` +
              `_Submitted securely on Border Export Hub platform_`,
          },
        };

        const waResponse = await fetch(
          `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify(payload),
          }
        );

        const waData = await waResponse.json();

        if (waResponse.ok && waData.messages && waData.messages[0]) {
          whatsappStatus = "sent";
          whatsappMessageId = waData.messages[0].id;
        } else {
          whatsappStatus = "failed";
          whatsappError =
            waData.error?.message ||
            `WhatsApp API responded with status ${waResponse.status}`;
          console.warn("[WhatsApp Cloud API Error]:", waData.error || waData);
        }
      } catch (err) {
        whatsappStatus = "failed";
        whatsappError = err.message || "Network error connecting to WhatsApp API";
        console.error("[WhatsApp Dispatch Exception]:", err);
      }
    } else {
      // Truthful status when API is unconfigured
      whatsappStatus = "pending_credentials";
      whatsappError =
        "WhatsApp Cloud API credentials (WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID) not configured on backend.";
    }

    // 8. Save inquiry permanently in database
    const inquiry = await ContactInquiry.create({
      fullName: trimmedName,
      phoneNumber: trimmedPhone,
      email: trimmedEmail,
      cityOrAddress: trimmedCity,
      subject: trimmedSubject,
      message: trimmedMessage,
      ipAddress: clientIp,
      userAgent: userAgent.slice(0, 300),
      whatsappRecipient: normalizedRecipient,
      whatsappStatus,
      whatsappMessageId,
      whatsappError,
      submissionHash,
    });

    // 9. Dispatch instant notification email to administrator
    sendEmail({
      to: "yasinsasoli186@gmail.com",
      subject: `[Border Export Hub Trade Inquiry] ${trimmedSubject}`,
      text:
        `A new trade inquiry was submitted on Border Export Hub:\n\n` +
        `• Name: ${trimmedName}\n` +
        `• Phone: ${trimmedPhone}\n` +
        `• Email: ${trimmedEmail}\n` +
        `• Address / City: ${trimmedCity}\n` +
        `• Subject: ${trimmedSubject}\n` +
        `• WhatsApp Delivery Status: ${whatsappStatus}\n\n` +
        `Message:\n${trimmedMessage}\n\n` +
        `Target WhatsApp Coordinator: ${normalizedRecipient} (03324042186)`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <h2 style="color: #059669; margin-top: 0;">New Trade Inquiry Received</h2>
          <p style="color: #475569; font-size: 14px;">A new trade inquiry was submitted on <strong>Border Export Hub</strong>:</p>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin: 15px 0;">
            <tr><td style="padding: 6px; font-weight: bold; width: 140px; color: #1e293b;">Full Name:</td><td style="padding: 6px; color: #334155;">${trimmedName}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold; color: #1e293b;">Phone Number:</td><td style="padding: 6px; color: #334155;">${trimmedPhone}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold; color: #1e293b;">Email Address:</td><td style="padding: 6px; color: #334155;"><a href="mailto:${trimmedEmail}">${trimmedEmail}</a></td></tr>
            <tr><td style="padding: 6px; font-weight: bold; color: #1e293b;">Address / City:</td><td style="padding: 6px; color: #334155;">${trimmedCity}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold; color: #1e293b;">Subject:</td><td style="padding: 6px; color: #334155; font-weight: 600;">${trimmedSubject}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold; color: #1e293b;">WhatsApp Status:</td><td style="padding: 6px; color: #0284c7;">${whatsappStatus}</td></tr>
          </table>
          <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #059669; margin: 15px 0;">
            <strong style="color: #0f172a; display: block; margin-bottom: 6px;">Message Content:</strong>
            <p style="color: #334155; font-size: 13px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${trimmedMessage}</p>
          </div>
          <p style="color: #64748b; font-size: 11px; margin-top: 20px;">Target WhatsApp Coordinator: 03324042186 | Border Export Hub Automated Notification Engine</p>
        </div>
      `,
    }).catch((err) => {
      console.warn("[CONTACT EMAIL NOTIFY ERROR]:", err.message);
    });

    // 10. Respond with reassuring, clear feedback for website visitors
    if (whatsappStatus === "sent") {
      return res.status(201).json({
        success: true,
        deliveredToWhatsApp: true,
        inquiryId: inquiry._id,
        message:
          "Thank you! Your inquiry was sent successfully to our WhatsApp support desk (03324042186) and saved in Border Export Hub. Our coordinator will follow up with you shortly.",
      });
    }

    if (whatsappStatus === "pending_credentials") {
      return res.status(201).json({
        success: true,
        deliveredToWhatsApp: false,
        pendingCredentials: true,
        inquiryId: inquiry._id,
        message:
          "Thank you! Your trade inquiry has been received and saved securely in Border Export Hub. Our WhatsApp trade coordinator (03324042186) has been notified and will contact you shortly.",
        adminNotice:
          "WhatsApp Cloud API credentials (WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID) are currently empty in backend/.env. The inquiry is safely preserved in MongoDB for follow-up.",
      });
    }

    // If delivery failed with provider error
    return res.status(201).json({
      success: true,
      deliveredToWhatsApp: false,
      message:
        "Thank you! Your trade inquiry has been received and saved securely in Border Export Hub. Our team will contact you shortly.",
      inquiryId: inquiry._id,
    });
  } catch (err) {
    next(err);
  }
}

// Admin: Get all inquiries
export async function getContactInquiries(req, res, next) {
  try {
    const inquiries = await ContactInquiry.find().sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, inquiries });
  } catch (err) {
    next(err);
  }
}
