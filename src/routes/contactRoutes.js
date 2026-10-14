import express from "express";
import { submitContactInquiry, getContactInquiries } from "../controllers/contactController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public: Submit inquiry from Home Page Contact Us form
router.post("/inquiry", submitContactInquiry);

// Admin: Retrieve inquiries
router.get("/inquiries", requireAuth, getContactInquiries);

export default router;
