import express from "express";
import { getVerification, submitVerification } from "../controllers/verificationController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", requireAuth, getVerification);
router.post("/", requireAuth, submitVerification);

export default router;
