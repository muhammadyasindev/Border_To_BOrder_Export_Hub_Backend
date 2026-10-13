import express from "express";
import crypto from "crypto";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/ice-servers", requireAuth, (req, res) => {
  const user = req.user;
  const turnUrl = process.env.TURN_SERVER_URL;
  const turnSecret = process.env.TURN_SECRET;

  const defaultStunServers = [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ];

  if (turnUrl && turnSecret) {
    const ttlSeconds = 3600;
    const expiresTimestamp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const username = `${expiresTimestamp}:${user._id}`;
    const credential = crypto
      .createHmac("sha1", turnSecret)
      .update(username)
      .digest("base64");

    return res.json({
      iceServers: [
        ...defaultStunServers,
        {
          urls: [turnUrl],
          username,
          credential,
        },
      ],
      expiresAt: expiresTimestamp * 1000,
      turnConfigured: true,
    });
  }

  return res.json({
    iceServers: defaultStunServers,
    turnConfigured: false,
    notice: "Operating with STUN only. Cellular symmetric NAT environments require TURN_SECRET configuration.",
  });
});

export default router;
