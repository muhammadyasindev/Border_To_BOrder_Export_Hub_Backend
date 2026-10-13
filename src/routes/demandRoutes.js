import express from "express";
import * as demandController from "../controllers/demandController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", demandController.getDemands);
router.post("/", requireAuth, demandController.createDemand);

export default router;
