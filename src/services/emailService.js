import nodemailer from "nodemailer";
import { env } from "../config/env.js";

export async function sendEmail({ to, subject, text, html }) {
  const cleanTo = (to || "").trim().toLowerCase();
  if (!cleanTo) return { success: false, error: "Recipient email is required" };

  // 1. Try Gmail SMTP if configured
  if (env.SMTP_USER && env.SMTP_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: env.EMAIL_FROM || `BorderGlow Verification <${env.SMTP_USER}>`,
        to: cleanTo,
        subject,
        text,
        html: html || text.replace(/\n/g, "<br>"),
      });

      console.log(`[EMAIL DISPATCH] Successfully delivered email via SMTP to ${cleanTo}`);
      return { success: true };
    } catch (err) {
      console.error("[EMAIL ERROR] SMTP dispatch failed:", err.message);
      // Fall through to Resend API fallback if available
    }
  }

  // 2. Try Resend API if configured
  if (env.RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env.EMAIL_FROM,
          to: [cleanTo],
          subject,
          text,
          html: html || text.replace(/\n/g, "<br>"),
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        return { success: false, error: errJson.message || `Resend rejected dispatch (HTTP ${res.status})` };
      }

      console.log(`[EMAIL DISPATCH] Successfully delivered email via Resend to ${cleanTo}`);
      return { success: true };
    } catch (err) {
      console.error("[EMAIL ERROR] Resend dispatch failed:", err.message);
    }
  }

  console.warn(`[EMAIL WARNING] No active email provider configured for ${cleanTo}`);
  return {
    success: false,
    error: "Email transport service is not configured. Please configure SMTP credentials (SMTP_USER and SMTP_PASS) or RESEND_API_KEY.",
  };
}
