import express from "express";
import * as productController from "../controllers/productController.js";
import { requireAuth, optionalAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public / Filtered Products
router.get("/", optionalAuth, productController.getProducts);
router.get("/offers/all", optionalAuth, productController.getAllProductOffers);
router.get("/:id", productController.getProductById);

// Exporter Management
router.post("/", requireAuth, productController.createProduct);
router.put("/:id", requireAuth, productController.updateProduct);
router.patch("/:id", requireAuth, productController.updateProduct);
router.patch("/:id/status", requireAuth, productController.updateProductStatus);
router.delete("/:id", requireAuth, productController.deleteProduct);

// Promotional Offers attached to Product
router.post("/:id/offers", requireAuth, productController.createProductOffer);
router.patch("/offers/:offerId/status", requireAuth, productController.updateProductOfferStatus);
router.delete("/offers/:offerId", requireAuth, productController.deleteProductOffer);

export default router;
