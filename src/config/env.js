import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT || "3001", 10),
  MONGODB_URI: process.env.MONGODB_URI || process.env.DATABASE_URL || "mongodb://127.0.0.1:27017/borderglow",
  SESSION_SECRET: process.env.SESSION_SECRET || process.env.JWT_SECRET || "bg_prod_session_secret_f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4",
  FRONTEND_URL: process.env.FRONTEND_URL || "https://border-to-border-export-frontend.vercel.app",
  ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS || "https://border-to-border-export-frontend.vercel.app,http://localhost:5173,http://localhost:3000")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean),
  COOKIE_SAME_SITE: process.env.COOKIE_SAME_SITE || "lax",
  SMTP_HOST: process.env.SMTP_HOST || "smtp.gmail.com",
  SMTP_PORT: parseInt(process.env.SMTP_PORT || "465", 10),
  SMTP_SECURE: process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465" || !process.env.SMTP_PORT,
  SMTP_USER: process.env.SMTP_USER || "yasinsasoli186@gmail.com",
  SMTP_PASS: (process.env.SMTP_PASS || "snmpfykuplxhvsud").replace(/\s+/g, ""),
  EMAIL_FROM: process.env.EMAIL_FROM || "Border Export Hub Verification <yasinsasoli186@gmail.com>",
  RESEND_API_KEY: process.env.RESEND_API_KEY || "",
  ATTACHMENT_STORAGE_DIR: process.env.ATTACHMENT_STORAGE_DIR || path.resolve(process.cwd(), "data", "attachments"),
  ENABLE_DEV_PERSONA_SWITCH: process.env.ENABLE_DEV_PERSONA_SWITCH === "true",
};

export default env;
