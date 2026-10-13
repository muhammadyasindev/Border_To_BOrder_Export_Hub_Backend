import mongoose from "mongoose";
import { env } from "./env.js";

let isConnected = false;

export async function connectDB() {
  if (isConnected) return;

  const mongoUri = env.MONGODB_URI;

  try {
    mongoose.set("strictQuery", false);

    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    isConnected = true;
    const sanitizedHost = mongoUri.split("@").pop().split("?")[0];
    console.log(`[DATABASE] Successfully connected to MongoDB at ${sanitizedHost}`);
  } catch (err) {
    console.warn(`[DATABASE WARNING] MongoDB connection pending or unavailable: ${err.message}`);
    // Non-fatal on startup so server can still serve health check and show diagnostic message
  }

  mongoose.connection.on("error", (err) => {
    console.error("[DATABASE ERROR] MongoDB connection error:", err.message);
  });

  mongoose.connection.on("disconnected", () => {
    isConnected = false;
    console.warn("[DATABASE DISCONNECTED] Lost MongoDB connection. Reconnecting...");
  });
}

export default connectDB;
