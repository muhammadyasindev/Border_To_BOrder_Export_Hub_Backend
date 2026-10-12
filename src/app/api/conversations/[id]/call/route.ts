import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { conversationParticipants, conversations, messages, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// In-memory active call signaling sessions mapped by conversationId
interface CallSession {
  conversationId: number;
  callType: "voice" | "video";
  status: "idle" | "ringing" | "connected" | "ended" | "rejected";
  callerId: number;
  callerName: string;
  callerRole: string;
  targetUserId?: number;
  offerSdp?: any;
  answerSdp?: any;
  iceCandidates: any[];
  startedAt?: number;
  connectedAt?: number;
  endedAt?: number;
}

const activeCallSessions = new Map<number, CallSession>();

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const conversationId = Number(id);

  // Authorize user is a participant
  const [membership] = await db.select().from(conversationParticipants)
    .where(and(
      eq(conversationParticipants.conversationId, conversationId),
      eq(conversationParticipants.userId, user.id)
    ))
    .limit(1);

  if (!membership) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const session = activeCallSessions.get(conversationId);
  return NextResponse.json({
    call: session || { status: "idle", conversationId },
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const conversationId = Number(id);

  // Authorize user is participant
  const [membership] = await db.select().from(conversationParticipants)
    .where(and(
      eq(conversationParticipants.conversationId, conversationId),
      eq(conversationParticipants.userId, user.id)
    ))
    .limit(1);

  if (!membership) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { action, callType, offerSdp, answerSdp, candidate } = body;

    let session = activeCallSessions.get(conversationId);

    if (action === "initiate") {
      // Create new call session
      session = {
        conversationId,
        callType: callType || "voice",
        status: "ringing",
        callerId: user.id,
        callerName: user.fullName,
        callerRole: user.role,
        offerSdp: offerSdp || null,
        iceCandidates: [],
        startedAt: Date.now(),
      };
      activeCallSessions.set(conversationId, session);

      return NextResponse.json({ success: true, call: session });
    }

    if (action === "answer") {
      if (!session) {
        return NextResponse.json({ error: "No active call session to answer" }, { status: 400 });
      }
      session.status = "connected";
      session.answerSdp = answerSdp || session.answerSdp;
      session.connectedAt = Date.now();
      activeCallSessions.set(conversationId, session);

      return NextResponse.json({ success: true, call: session });
    }

    if (action === "candidate") {
      if (!session) {
        return NextResponse.json({ error: "No active call" }, { status: 400 });
      }
      if (candidate) {
        session.iceCandidates.push({
          candidate,
          senderId: user.id,
        });
      }
      return NextResponse.json({ success: true });
    }

    if (action === "reject" || action === "end") {
      if (session) {
        const durationSec = session.connectedAt
          ? Math.round((Date.now() - session.connectedAt) / 1000)
          : 0;

        const callIcon = session.callType === "video" ? "📹" : "📞";
        const callLabel = session.callType === "video" ? "Video Call" : "Voice Call";
        const mins = Math.floor(durationSec / 60);
        const secs = durationSec % 60;
        const durationStr = durationSec > 0 ? `${mins}m ${secs}s` : "missed / cancelled";

        // Record a call history message in conversation
        await db.insert(messages).values({
          conversationId,
          senderId: user.id,
          content: `${callIcon} ${callLabel} ${action === "reject" ? "Declined" : "Ended"} (${durationStr})`,
        });

        session.status = action === "reject" ? "rejected" : "ended";
        session.endedAt = Date.now();

        // Clear after short grace window
        setTimeout(() => {
          activeCallSessions.delete(conversationId);
        }, 3000);
      }

      return NextResponse.json({ success: true, status: "ended", call: { status: "ended" } });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
