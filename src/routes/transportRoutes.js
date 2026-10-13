import express from "express";
import * as transportController from "../controllers/transportController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", transportController.getOffers);
router.post("/", requireAuth, transportController.createOffer);

export default router;
