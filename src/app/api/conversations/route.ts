import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { conversations, conversationParticipants, messages, users, products, buyerDemands, transportOffers } from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";

// List authorized conversations for current user
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Find all conversation IDs where user is a participant
    const userMemberships = await db.select({
      conversationId: conversationParticipants.conversationId,
      roleInDeal: conversationParticipants.roleInDeal,
    })
    .from(conversationParticipants)
    .where(eq(conversationParticipants.userId, user.id));

    if (userMemberships.length === 0) {
      return NextResponse.json({ conversations: [] });
    }

    const convIds = userMemberships.map((m: any) => m.conversationId);

    // 2. Fetch conversation records
    const convList = await db.select().from(conversations)
      .where(inArray(conversations.id, convIds))
      .orderBy(desc(conversations.updatedAt));

    // 3. For each conversation, attach participant names and last message
    const detailed = await Promise.all(convList.map(async (conv: any) => {
      const parts = await db.select({
        userId: users.id,
        fullName: users.fullName,
        businessName: users.businessName,
        role: users.role,
        roleInDeal: conversationParticipants.roleInDeal,
        verificationStatus: users.verificationStatus,
      })
      .from(conversationParticipants)
      .leftJoin(users, eq(conversationParticipants.userId, users.id))
      .where(eq(conversationParticipants.conversationId, conv.id));

      const [lastMsg] = await db.select().from(messages)
        .where(eq(messages.conversationId, conv.id))
        .orderBy(desc(messages.createdAt))
        .limit(1);

      return {
        ...conv,
        participants: parts,
        lastMessage: lastMsg || null,
      };
    }));

    return NextResponse.json({ conversations: detailed });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Create new deal conversation room
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { title, targetUserId, targetUserRole, productId, demandId, transportOfferId, initialMessage } = body;

    if (!title || !targetUserId) {
      return NextResponse.json({ error: "Title and target user are required" }, { status: 400 });
    }

    if (Number(targetUserId) === user.id) {
      // Find an alternate participant if user clicked their own listing
      const [otherUser] = await db.select().from(users).where(eq(users.role, transportOfferId ? "driver" : "exporter")).limit(1);
      if (otherUser && otherUser.id !== user.id) {
        // use otherUser
      }
    }

    // Determine roles in this transaction
    const [targetUser] = await db.select().from(users).where(eq(users.id, Number(targetUserId))).limit(1);
    const counterRole = targetUserRole || (transportOfferId ? "driver" : targetUser?.role || "buyer");
    const myRoleInDeal = user.role === "driver" && transportOfferId ? "driver" : (user.role || "importer");

    const [newConv] = await db.insert(conversations).values({
      title,
      dealSubjectType: productId ? "product" : demandId ? "demand" : transportOfferId ? "transport" : "deal",
      productId: productId ? Number(productId) : null,
      demandId: demandId ? Number(demandId) : null,
      transportOfferId: transportOfferId ? Number(transportOfferId) : null,
      dealStatus: "inquiry",
    }).returning();

    // Add current user
    await db.insert(conversationParticipants).values({
      conversationId: newConv.id,
      userId: user.id,
      roleInDeal: myRoleInDeal,
    });

    // Add counterparty
    if (Number(targetUserId) !== user.id) {
      await db.insert(conversationParticipants).values({
        conversationId: newConv.id,
        userId: Number(targetUserId),
        roleInDeal: counterRole,
      });
    }

    // Add initial message with explicit senderRole
    if (initialMessage) {
      await db.insert(messages).values({
        conversationId: newConv.id,
        senderId: user.id,
        senderRole: myRoleInDeal,
        content: initialMessage,
      });
    }

    return NextResponse.json({ success: true, conversation: newConv });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
