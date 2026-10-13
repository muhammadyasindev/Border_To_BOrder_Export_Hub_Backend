import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";

// Routes
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import demandRoutes from "./routes/demandRoutes.js";
import vehicleRoutes from "./routes/vehicleRoutes.js";
import transportRoutes from "./routes/transportRoutes.js";
import shipmentRoutes from "./routes/shipmentRoutes.js";
import conversationRoutes from "./routes/conversationRoutes.js";
import newsRoutes from "./routes/newsRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import verificationRoutes from "./routes/verificationRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import attachmentRoutes from "./routes/attachmentRoutes.js";
import webrtcRoutes from "./routes/webrtcRoutes.js";
import seedRoutes from "./routes/seedRoutes.js";

const app = express();

// CORS setup supporting both local dev and production domains
const allowedOrigins = [
  env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith(".vercel.app") ||
        origin.endsWith(".onrender.com")
      ) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in dev/staging to avoid blocking dynamic deployments
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-compliance-grant-token"],
  })
);

app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(cookieParser());
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Health Check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "BorderGlow Express API Engine",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Mount Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/demands", demandRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/transport", transportRoutes);
app.use("/api/shipments", shipmentRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/verification", verificationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/users", userRoutes);
app.use("/api/profiles", profileRoutes);
app.use("/api/attachments", attachmentRoutes);
app.use("/api/webrtc", webrtcRoutes);
app.use("/api/seed", seedRoutes);

// Centralized error handler
app.use(errorHandler);

export default app;
