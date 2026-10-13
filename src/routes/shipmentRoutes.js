import express from "express";
import * as shipmentController from "../controllers/shipmentController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", requireAuth, shipmentController.getShipments);
router.post("/", requireAuth, shipmentController.createShipment);
router.patch("/", requireAuth, shipmentController.updateLocation);

export default router;
