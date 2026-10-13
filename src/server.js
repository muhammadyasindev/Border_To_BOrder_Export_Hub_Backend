import app from "./app.js";
import { connectDB } from "./config/db.js";
import { env } from "./config/env.js";
import { seedDatabase } from "./services/seedService.js";

const PORT = env.PORT || 3001;

async function startServer() {
  // Connect to database
  await connectDB();

  // In development, auto-seed if empty
  if (env.NODE_ENV !== "production") {
    try {
      await seedDatabase();
    } catch (e) {
      console.warn("[SEED WARNING] Initial seed skipped or already applied:", e.message);
    }
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`=======================================================`);
    console.log(`  BorderGlow Express API Server running on port ${PORT}`);
    console.log(`  Environment: ${env.NODE_ENV}`);
    console.log(`  Health Check: http://localhost:${PORT}/api/health`);
    console.log(`=======================================================`);
  });

  function shutdown(signal) {
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);
    server.close(() => {
      console.log("HTTP server closed.");
      process.exit(0);
    });
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer();
