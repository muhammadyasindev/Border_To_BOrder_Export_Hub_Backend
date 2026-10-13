import express from "express";
import {
  getConversations,
  createConversation,
  getConversationById,
  postMessage,
  handleSignaling,
} from "../controllers/conversationController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(requireAuth);

router.get("/", getConversations);
router.post("/", createConversation);
router.get("/:id", getConversationById);
router.post("/:id/messages", postMessage);
router.post("/:id/signal", handleSignaling);

export default router;
