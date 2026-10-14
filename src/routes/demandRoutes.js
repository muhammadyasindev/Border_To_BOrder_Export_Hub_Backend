import express from "express";
import * as demandController from "../controllers/demandController.js";
import { requireAuth, optionalAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", optionalAuth, demandController.getDemands);
router.get("/:id", demandController.getDemandById);

router.post("/", requireAuth, demandController.createDemand);
router.put("/:id", requireAuth, demandController.updateDemand);
router.patch("/:id/status", requireAuth, demandController.updateDemandStatus);
router.delete("/:id", requireAuth, demandController.deleteDemand);

export default router;
