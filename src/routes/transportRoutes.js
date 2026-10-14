import express from "express";
import * as transportController from "../controllers/transportController.js";
import { requireAuth, optionalAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

// 1. Transport Offers (published by Drivers) - Support /offers explicitly
router.get("/offers", optionalAuth, transportController.getOffers);
router.post("/offers", requireAuth, transportController.createOffer);
router.get("/offers/:id", transportController.getOfferById);
router.put("/offers/:id", requireAuth, transportController.updateOffer);
router.patch("/offers/:id/status", requireAuth, transportController.updateOfferStatus);
router.delete("/offers/:id", requireAuth, transportController.deleteOffer);

// 2. Transport Requests (published by Importers & Exporters)
router.get("/requests/all", optionalAuth, transportController.getTransportRequests);
router.get("/requests", optionalAuth, transportController.getTransportRequests);
router.get("/requests/:id", transportController.getTransportRequestById);
router.post("/requests", requireAuth, transportController.createTransportRequest);
router.put("/requests/:id", requireAuth, transportController.updateTransportRequest);
router.patch("/requests/:id/status", requireAuth, transportController.updateTransportRequestStatus);
router.delete("/requests/:id", requireAuth, transportController.deleteTransportRequest);

// 3. Root aliases for Transport Offers (/api/transport)
router.get("/", optionalAuth, transportController.getOffers);
router.post("/", requireAuth, transportController.createOffer);
router.get("/:id", transportController.getOfferById);
router.put("/:id", requireAuth, transportController.updateOffer);
router.patch("/:id/status", requireAuth, transportController.updateOfferStatus);
router.delete("/:id", requireAuth, transportController.deleteOffer);

export default router;
