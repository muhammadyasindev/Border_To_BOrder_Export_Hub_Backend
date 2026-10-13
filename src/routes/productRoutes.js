import express from "express";
import * as productController from "../controllers/productController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", productController.getProducts);
router.get("/:id", productController.getProductById);
router.post("/", requireAuth, productController.createProduct);

export default router;
