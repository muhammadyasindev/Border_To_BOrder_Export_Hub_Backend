import { NextResponse } from "next/server";
import crypto from "crypto";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const turnUrl = process.env.TURN_SERVER_URL;
  const turnSecret = process.env.TURN_SECRET;

  const defaultStunServers = [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ];

  if (turnUrl && turnSecret) {
    // Generate standard RFC 5766 / REST API ephemeral TURN credentials (1 hour lifetime)
    const ttlSeconds = 3600;
    const expiresTimestamp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const username = `${expiresTimestamp}:${user.id}`;
    const credential = crypto
      .createHmac("sha1", turnSecret)
      .update(username)
      .digest("base64");

    return NextResponse.json({
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

  // Fallback to STUN servers when TURN provider is not configured
  return NextResponse.json({
    iceServers: defaultStunServers,
    turnConfigured: false,
    notice: "Operating with STUN only. Cellular symmetric NAT environments require TURN_SECRET configuration.",
  });
}
