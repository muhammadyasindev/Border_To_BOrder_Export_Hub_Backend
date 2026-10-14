import nodemailer from "nodemailer";
import { env } from "../config/env.js";

// Connection pool for Gmail SMTP: delivers in ~1 second with connection reuse
let cachedTransporter = null;

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const user = env.SMTP_USER || "yasinsasoli186@gmail.com";
  const pass = (env.SMTP_PASS || "snmpfykuplxhvsud").replace(/\s+/g, "");

  cachedTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user,
      pass,
    },
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
    connectionTimeout: 6000,
    greetingTimeout: 5000,
    socketTimeout: 8000,
  });

  return cachedTransporter;
}

export async function sendEmail({ to, subject, text, html }) {
  const cleanTo = (to || "").trim().toLowerCase();
  if (!cleanTo) return { success: false, error: "Recipient email is required" };

  // 1. Primary: Direct Gmail SMTP (delivers to ANY recipient email address: Gmail, Yahoo, Outlook, custom domain)
  const user = env.SMTP_USER || "yasinsasoli186@gmail.com";
  const pass = (env.SMTP_PASS || "snmpfykuplxhvsud").replace(/\s+/g, "");

  if (user && pass) {
    try {
      const transporter = getTransporter();

      await transporter.sendMail({
        from: env.EMAIL_FROM || `BorderGlow Verification <${user}>`,
        to: cleanTo,
        subject,
        text,
        html: html || text.replace(/\n/g, "<br>"),
      });

      console.log(`[EMAIL DISPATCH] Successfully delivered email via SMTP to destination: ${cleanTo}`);
      return { success: true };
    } catch (err) {
      console.error(`[EMAIL ERROR] SMTP dispatch to ${cleanTo} failed:`, err.message);
      cachedTransporter = null;
    }
  }

  // 2. Secondary fallback: Resend API (only if configured and domain allows)
  if (env.RESEND_API_KEY) {
    try {
      const resendFrom =
        env.EMAIL_FROM && !env.EMAIL_FROM.toLowerCase().includes("@gmail.com")
          ? env.EMAIL_FROM
          : "BorderGlow Verification <onboarding@resend.dev>";

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: resendFrom,
          to: [cleanTo],
          subject,
          text,
          html: html || text.replace(/\n/g, "<br>"),
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        console.warn(`[EMAIL WARNING] Resend rejected dispatch to ${cleanTo}:`, errJson.message || res.status);
        return { success: false, error: errJson.message || `Resend rejected dispatch (HTTP ${res.status})` };
      }

      console.log(`[EMAIL DISPATCH] Successfully delivered email via Resend to destination: ${cleanTo}`);
      return { success: true };
    } catch (err) {
      console.error(`[EMAIL ERROR] Resend dispatch to ${cleanTo} failed:`, err.message);
    }
  }

  console.warn(`[EMAIL WARNING] No active email provider configured for ${cleanTo}`);
  return {
    success: false,
    error: "Email transport service is not configured. Please configure SMTP credentials.",
  };
}
