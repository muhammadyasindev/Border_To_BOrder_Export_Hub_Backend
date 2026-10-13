/**
 * Production environment validation for BorderGlow.
 * Validates presence and security constraints of required environment variables
 * without exposing secret values in logs or terminal outputs.
 */

export interface EnvValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  environment: string;
  databaseDriver: "postgres" | "pglite";
}

export function validateEnvironment(): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const environment = process.env.NODE_ENV || "development";
  const isProduction = environment === "production";
  const usePostgres = process.env.USE_POSTGRES === "true";

  // 1. Session secret validation
  const sessionSecret = process.env.SESSION_SECRET || process.env.JWT_SECRET;
  if (!sessionSecret) {
    if (isProduction) {
      warnings.push("SESSION_SECRET or JWT_SECRET is not configured in production environment. An ephemeral runtime secret has been generated to keep the server operational; set SESSION_SECRET (32+ chars) in dashboard for persistent sessions across restarts.");
    } else {
      warnings.push("SESSION_SECRET is not configured; using local dev secret.");
    }
  } else {
    if (sessionSecret.length < 32) {
      warnings.push("SESSION_SECRET is shorter than 32 characters. Consider using a 32+ character high-entropy key for production security.");
    }
    if (sessionSecret.includes("borderglow_hmac_secret_key_prod") || sessionSecret.includes("default") || sessionSecret.includes("example")) {
      warnings.push("SESSION_SECRET appears to use a default or placeholder value. Update it in your hosting dashboard.");
    }
  }

  // 2. Database configuration validation
  const databaseUrl = process.env.DATABASE_URL;
  if (usePostgres) {
    if (!databaseUrl) {
      errors.push("DATABASE_URL is required when USE_POSTGRES=true.");
    } else if (!databaseUrl.startsWith("postgres://") && !databaseUrl.startsWith("postgresql://")) {
      errors.push("DATABASE_URL must be a valid PostgreSQL connection URI (starting with postgres:// or postgresql://).");
    }
  }

  // 3. Email service provider validation (Resend)
  const resendApiKey = process.env.RESEND_API_KEY;
  if (isProduction && !resendApiKey) {
    warnings.push("RESEND_API_KEY is not configured in production. Password recovery email dispatch will safely return 503 Service Unavailable.");
  }

  // 4. Persona switching flag
  if (isProduction && process.env.ENABLE_DEV_PERSONA_SWITCH === "true") {
    warnings.push("ENABLE_DEV_PERSONA_SWITCH is ignored in production environment for security.");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    environment,
    databaseDriver: usePostgres ? "postgres" : "pglite",
  };
}
