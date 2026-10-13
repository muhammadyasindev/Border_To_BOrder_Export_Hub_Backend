import express from "express";
import { getNews, createNews } from "../controllers/newsController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", getNews);
router.post("/", requireAuth, createNews);

export default router;
