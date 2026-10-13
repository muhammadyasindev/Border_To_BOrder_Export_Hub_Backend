import express from "express";
import { getAttachment } from "../controllers/attachmentController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/:id", requireAuth, getAttachment);

export default router;
