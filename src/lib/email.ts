import nodemailer from "nodemailer";

export interface EmailDispatchOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail({
  to,
  subject,
  text,
  html,
}: EmailDispatchOptions): Promise<{ success: boolean; error?: string }> {
  const cleanTo = to.trim().toLowerCase();

  // 1. Prioritize Gmail SMTP if SMTP credentials are configured
  const smtpUser = (process.env.SMTP_USER || process.env.GMAIL_USER)?.replace(/^["']|["']$/g, "").trim();
  const smtpPass = (process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD)?.replace(/^["']|["']$/g, "").replace(/\s+/g, "").trim();

  if (smtpUser && smtpPass) {
    try {
      const smtpHost = (process.env.SMTP_HOST || "smtp.gmail.com").replace(/^["']|["']$/g, "").trim();
      const smtpPort = parseInt(
        process.env.SMTP_PORT || (smtpHost === "smtp.gmail.com" ? "465" : "587"),
        10
      );
      const secure = process.env.SMTP_SECURE === "true" || smtpPort === 465;

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const rawFrom =
        process.env.EMAIL_FROM ||
        process.env.FROM_EMAIL ||
        `BorderGlow Verification <${smtpUser}>`;
      const from = rawFrom.replace(/^["']|["']$/g, "").trim();

      await transporter.sendMail({
        from,
        to: cleanTo,
        subject,
        text,
        html: html || text.replace(/\n/g, "<br>"),
      });

      console.log(`[EMAIL DISPATCH] Successfully delivered email via SMTP to ${cleanTo}`);
      return { success: true };
    } catch (e: any) {
      console.error("SMTP delivery failure:", e?.message || e);
      return { success: false, error: e?.message || "SMTP transmission failure" };
    }
  }

  // 2. Fallback to Resend API if RESEND_API_KEY is present
  const resendApiKey = process.env.RESEND_API_KEY?.replace(/^["']|["']$/g, "").trim();
  if (resendApiKey) {
    try {
      const rawFrom =
        process.env.EMAIL_FROM ||
        process.env.FROM_EMAIL ||
        "BorderGlow Verification <onboarding@resend.dev>";
      const from = rawFrom.replace(/^["']|["']$/g, "").trim();

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [cleanTo],
          subject,
          text,
          html: html || text.replace(/\n/g, "<br>"),
        }),
      });

      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
          name?: string;
        };
        console.error("Resend delivery rejected:", errJson);
        const errMsg =
          errJson.message ||
          errJson.error ||
          `Resend rejected dispatch (HTTP ${res.status})`;
        return {
          success: false,
          error: errMsg,
        };
      }

      console.log(`[EMAIL DISPATCH] Successfully sent email via Resend to ${cleanTo}`);
      return { success: true };
    } catch (e: any) {
      console.error("Resend API request exception:", e);
      return { success: false, error: e?.message || "Failed to reach Resend API" };
    }
  }

  // 3. Neither SMTP nor Resend is configured
  console.warn(`[EMAIL DISPATCH ERROR] No email transport configured in .env for ${cleanTo}`);
  return {
    success: false,
    error:
      "Email transport service is not configured. Please configure SMTP credentials (SMTP_USER and SMTP_PASS) or RESEND_API_KEY in .env so the system can deliver the verification code to your email address.",
  };
}
