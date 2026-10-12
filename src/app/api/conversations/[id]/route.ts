import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { conversations, conversationParticipants, messages, users, shipments, products, buyerDemands } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { processAndStoreAttachment } from "@/lib/attachments";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const conversationId = Number(id);

  try {
    // 1. Authorization check: user must be participant, or admin with server-authorized durable compliance grant
    const [membership] = await db.select().from(conversationParticipants)
      .where(and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, user.id)
      ))
      .limit(1);

    let isAuditedComplianceAccess = false;
    if (!membership && user.role === "admin") {
      const grantToken = req.headers.get("x-compliance-grant-token");
      if (grantToken) {
        const { verifyComplianceGrant } = await import("@/lib/compliance");
        isAuditedComplianceAccess = await verifyComplianceGrant(grantToken, conversationId, user.id);
      }
    }

    if (!membership && !isAuditedComplianceAccess) {
      return NextResponse.json(
        { error: "Access denied to this private deal room. Compliance inspection requires a server-authorized case review grant." },
        { status: 403 }
      );
    }

    // 2. Fetch conversation record
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
    if (!conv) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // 3. Participants
    const participants = await db.select({
      id: users.id,
      fullName: users.fullName,
      businessName: users.businessName,
      role: users.role,
      roleInDeal: conversationParticipants.roleInDeal,
      verificationStatus: users.verificationStatus,
      country: users.country,
      city: users.city,
    })
    .from(conversationParticipants)
    .leftJoin(users, eq(conversationParticipants.userId, users.id))
    .where(eq(conversationParticipants.conversationId, conversationId));

    // 4. Message history with sender's role in deal
    const messageHistory = await db.select({
      id: messages.id,
      senderId: messages.senderId,
      senderRole: messages.senderRole,
      content: messages.content,
      attachmentName: messages.attachmentName,
      attachmentUrl: messages.attachmentUrl,
      attachmentType: messages.attachmentType,
      attachments: messages.attachments,
      voiceDuration: messages.voiceDuration,
      createdAt: messages.createdAt,
      senderName: users.fullName,
      userRole: users.role,
      userBusinessName: users.businessName,
    })
    .from(messages)
    .leftJoin(users, eq(messages.senderId, users.id))
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);

    // 5. Linked shipment if any
    const [linkedShipment] = await db.select().from(shipments)
      .where(eq(shipments.conversationId, conversationId))
      .limit(1);

    return NextResponse.json({
      conversation: conv,
      participants,
      messages: messageHistory,
      shipment: linkedShipment || null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Post message to conversation
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const conversationId = Number(id);

  try {
    // Auth check
    const [membership] = await db.select().from(conversationParticipants)
      .where(and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, user.id)
      ))
      .limit(1);

    if (!membership) {
      return NextResponse.json({ error: "Unauthorized to send messages in this room" }, { status: 403 });
    }

    const body = await req.json();
    const { content, attachmentName, attachmentType, attachments, voiceDuration } = body;

    if (!content && !attachmentName && !attachments && !voiceDuration) {
      return NextResponse.json({ error: "Message content or attachment required" }, { status: 400 });
    }

    const userRoleInDeal = membership?.roleInDeal || user.role;

    let storedAttachments: any[] = [];
    let primaryUrl = body.attachmentUrl || null;
    let primaryName = attachmentName || null;
    let primaryType = attachmentType || (voiceDuration ? "voice_note" : null);

    // 1. Process voice note if present
    if (body.attachmentUrl && (attachmentType === "voice_note" || voiceDuration)) {
      const voiceResult = await processAndStoreAttachment(
        { name: attachmentName || "Voice_Note.webm", dataUrl: body.attachmentUrl },
        conversationId,
        user.id
      );
      if (!voiceResult.success) {
        return NextResponse.json({ error: voiceResult.error }, { status: 400 });
      }
      primaryUrl = voiceResult.attachment?.url || primaryUrl;
      primaryName = voiceResult.attachment?.name || primaryName;
      primaryType = "voice_note";
    }

    // 2. Process multiple document attachments if present
    if (attachments && Array.isArray(attachments)) {
      if (attachments.length > 5) {
        return NextResponse.json({ error: "Maximum 5 attachments allowed per message" }, { status: 400 });
      }

      for (const item of attachments) {
        const stored = await processAndStoreAttachment(item, conversationId, user.id);
        if (!stored.success) {
          return NextResponse.json({ error: stored.error }, { status: 400 });
        }
        if (stored.attachment) {
          storedAttachments.push(stored.attachment);
        }
      }

      if (storedAttachments.length > 0 && !primaryUrl) {
        primaryUrl = storedAttachments[0].url;
        primaryName = storedAttachments[0].name;
        primaryType = storedAttachments[0].type;
      }
    }

    const [newMsg] = await db.insert(messages).values({
      conversationId,
      senderId: user.id,
      senderRole: userRoleInDeal,
      content: content || "",
      attachmentName: primaryName,
      attachmentType: primaryType,
      attachmentUrl: primaryUrl,
      attachments: storedAttachments.length > 0 ? JSON.stringify(storedAttachments) : (attachments ? (typeof attachments === "string" ? attachments : JSON.stringify(attachments)) : null),
      voiceDuration: voiceDuration ? String(voiceDuration) : null,
    }).returning();

    // Touch conversation updated_at
    await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, conversationId));

    return NextResponse.json({ success: true, message: newMsg });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Update deal status or invite 3rd party (e.g. transporter to convert to 3-way room)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const conversationId = Number(id);

  try {
    const body = await req.json();
    const { action, dealStatus, agreedPrice, agreedQuantity, newParticipantId, newParticipantRole } = body;

    if (action === "invite_participant") {
      if (!newParticipantId) {
        return NextResponse.json({ error: "newParticipantId required" }, { status: 400 });
      }

      // Check if already invited
      const [existing] = await db.select().from(conversationParticipants)
        .where(and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, Number(newParticipantId))
        ))
        .limit(1);

      if (!existing) {
        const [targetUser] = await db.select().from(users).where(eq(users.id, Number(newParticipantId))).limit(1);
        const resolvedRole = newParticipantRole || targetUser?.role || "partner";

        await db.insert(conversationParticipants).values({
          conversationId,
          userId: Number(newParticipantId),
          roleInDeal: resolvedRole,
        });

        // Add contextual system message
        let inviteAnnouncement = `🤝 ${targetUser?.fullName || 'Commercial Partner'} (${targetUser?.businessName || resolvedRole.toUpperCase()}) has been invited to this deal room by ${user.fullName}.`;
        if (resolvedRole === "driver" || resolvedRole === "transporter") {
          inviteAnnouncement = `🚛 Transporter ${targetUser?.fullName || 'Driver'} has been invited to coordinate cross-border logistics and convoy dispatch.`;
        } else if (resolvedRole === "exporter") {
          inviteAnnouncement = `📦 Exporter ${targetUser?.fullName || 'Supplier'} (${targetUser?.businessName || 'Trade Entity'}) has joined to provide export consignment documentation.`;
        } else if (resolvedRole === "importer") {
          inviteAnnouncement = `🏢 Importer / Buyer ${targetUser?.fullName || 'Buyer'} (${targetUser?.businessName || 'Trade Entity'}) has joined to review commercial terms.`;
        }

        await db.insert(messages).values({
          conversationId,
          senderId: user.id,
          content: inviteAnnouncement,
        });

        await db.update(conversations).set({
          dealStatus: resolvedRole === "driver" || resolvedRole === "transporter" ? "transporter_invited" : "inquiry",
          updatedAt: new Date(),
        }).where(eq(conversations.id, conversationId));
      }

      return NextResponse.json({ success: true, message: "Participant invited" });
    }

    if (dealStatus) {
      await db.update(conversations).set({
        dealStatus,
        agreedPrice: agreedPrice !== undefined ? String(agreedPrice) : undefined,
        agreedQuantity: agreedQuantity !== undefined ? String(agreedQuantity) : undefined,
        updatedAt: new Date(),
      }).where(eq(conversations.id, conversationId));

      await db.insert(messages).values({
        conversationId,
        senderId: user.id,
        content: `🔄 Deal status updated to: ${dealStatus.toUpperCase().replace("_", " ")} ${agreedPrice ? `($${agreedPrice})` : ''}`,
      });

      return NextResponse.json({ success: true, dealStatus });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
