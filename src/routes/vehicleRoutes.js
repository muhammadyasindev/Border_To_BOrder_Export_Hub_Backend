import express from "express";
import * as vehicleController from "../controllers/vehicleController.js";
import { optionalAuth, requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", optionalAuth, vehicleController.getVehicles);
router.post("/", requireAuth, vehicleController.createVehicle);

export default router;
