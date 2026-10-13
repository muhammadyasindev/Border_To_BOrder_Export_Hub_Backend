import express from "express";
import {
  getAdminVerificationDocs,
  reviewVerificationDoc,
  authorizeComplianceGrant,
} from "../controllers/adminController.js";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(requireAuth);
router.use(requireRole(["admin"]));

router.get("/verification", getAdminVerificationDocs);
router.post("/verification", reviewVerificationDoc);
router.post("/compliance/authorize", authorizeComplianceGrant);

export default router;
