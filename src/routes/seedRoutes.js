import express from "express";
import { seedDatabase } from "../services/seedService.js";

const router = express.Router();

router.get("/", async (req, res, next) => {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_SEED !== "true") {
    return res.status(403).json({
      error: "Database seeding endpoint is disabled in production environments for data protection.",
    });
  }

  try {
    const result = await seedDatabase();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
