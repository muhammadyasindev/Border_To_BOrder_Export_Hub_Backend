import express from "express";
import { getDashboardSummary } from "../controllers/dashboardController.js";
import { optionalAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/summary", optionalAuth, getDashboardSummary);

export default router;
