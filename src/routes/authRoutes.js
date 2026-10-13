import express from "express";
import * as authController from "../controllers/authController.js";
import { optionalAuth } from "../middleware/authMiddleware.js";
import { ipRateLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

router.post("/register/send-otp", ipRateLimiter(10, 15 * 60 * 1000), authController.sendRegistrationOtp);
router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/logout", authController.logout);
router.get("/me", optionalAuth, authController.getMe);
router.post("/me", optionalAuth, authController.switchPersona);
router.post("/forgot-password", ipRateLimiter(5, 15 * 60 * 1000), authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);

export default router;
