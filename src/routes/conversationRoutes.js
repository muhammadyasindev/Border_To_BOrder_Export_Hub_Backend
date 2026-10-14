import express from "express";
import {
  getConversations,
  createConversation,
  getConversationById,
  postMessage,
  submitProposal,
  respondProposal,
  handleSignaling,
  updateConversation,
  getCallSession,
  handleCallAction,
} from "../controllers/conversationController.js";
import { requireAuth, optionalAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", optionalAuth, getConversations);

router.use(requireAuth);
router.post("/", createConversation);
router.get("/:id", getConversationById);
router.patch("/:id", updateConversation);
router.post("/:id", postMessage);
router.post("/:id/messages", postMessage);
router.get("/:id/call", getCallSession);
router.post("/:id/call", handleCallAction);
router.post("/:id/proposal", submitProposal);
router.post("/:id/proposal/respond", respondProposal);
router.post("/:id/signal", handleSignaling);

export default router;
