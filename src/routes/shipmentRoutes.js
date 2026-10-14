import express from "express";
import * as shipmentController from "../controllers/shipmentController.js";
import { requireAuth, optionalAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", optionalAuth, shipmentController.getShipments);
router.post("/", requireAuth, shipmentController.createShipment);
router.patch("/", requireAuth, shipmentController.updateLocation);

export default router;
