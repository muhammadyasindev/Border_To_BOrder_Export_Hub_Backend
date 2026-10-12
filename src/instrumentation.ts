/**
 * Next.js Server Lifecycle Instrumentation Hook.
 * Automatically runs once upon server startup to validate critical configuration
 * and prevent unsafe boots in production/staging environments.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnvironment } = await import("@/lib/env");
    const result = validateEnvironment();

    const env = process.env.NODE_ENV as string;
    if (!result.valid && (env === "production" || env === "staging")) {
      console.error("==================================================================");
      console.error("❌ CRITICAL SERVER STARTUP CONFIGURATION ERRORS DETECTED");
      for (const err of result.errors) {
        console.error(`  • ${err}`);
      }
      console.error("==================================================================");
      throw new Error(`Server startup halted due to invalid environment configuration: ${result.errors.join("; ")}`);
    }

    if (result.warnings.length > 0 && process.env.NODE_ENV !== "test") {
      for (const warn of result.warnings) {
        console.warn(`[CONFIG NOTICE] ${warn}`);
      }
    }
  }
}
