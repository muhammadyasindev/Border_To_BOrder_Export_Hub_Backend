import Conversation from "../models/Conversation.js";
import ConversationParticipant from "../models/ConversationParticipant.js";
import Message from "../models/Message.js";
import ComplianceAuditLog from "../models/ComplianceAuditLog.js";
import crypto from "crypto";

// 1. Get User Conversations
export async function getConversations(req, res, next) {
  try {
    const userId = req.user._id;

    // Find all conversation IDs where user is participant
    const memberships = await ConversationParticipant.find({ userId }).select("conversationId roleInDeal");
    const conversationIds = memberships.map((m) => m.conversationId);

    const conversations = await Conversation.find({ _id: { $in: conversationIds } })
      .populate("productId", "title category pricePerUnit currency imageUrl")
      .populate("demandId", "title category targetPrice currency")
      .populate("transportOfferId", "title originCorridor destinationCorridor ratePerKmOrTrip")
      .sort({ updatedAt: -1 });

    // Fetch participants for each conversation
    const result = await Promise.all(
      conversations.map(async (c) => {
        const parts = await ConversationParticipant.find({ conversationId: c._id }).populate(
          "userId",
          "fullName businessName role country city verificationStatus avatarUrl"
        );
        const lastMsg = await Message.findOne({ conversationId: c._id }).sort({ createdAt: -1 });

        return {
          ...c.toJSON(),
          participants: parts,
          lastMessage: lastMsg,
        };
      })
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
}

// 2. Create Deal Room Conversation
export async function createConversation(req, res, next) {
  try {
    const { title, recipientId, dealSubjectType, productId, demandId, transportOfferId, initialMessage } = req.body;

    if (!recipientId || !title) {
      return res.status(400).json({ error: "title and recipientId are required" });
    }

    const conversation = await Conversation.create({
      title: title.trim(),
      dealSubjectType: dealSubjectType || "general",
      productId: productId || null,
      demandId: demandId || null,
      transportOfferId: transportOfferId || null,
      dealStatus: "inquiry",
    });

    // Add sender participant
    await ConversationParticipant.create({
      conversationId: conversation._id,
      userId: req.user._id,
      roleInDeal: req.user.role === "driver" ? "transporter" : req.user.role === "importer" ? "buyer" : "exporter",
    });

    // Add recipient participant
    await ConversationParticipant.create({
      conversationId: conversation._id,
      userId: recipientId,
      roleInDeal: "buyer",
    });

    // Send initial message if provided
    if (initialMessage) {
      await Message.create({
        conversationId: conversation._id,
        senderId: req.user._id,
        senderRole: req.user.role,
        content: initialMessage.trim(),
      });
    }

    res.status(201).json(conversation);
  } catch (err) {
    next(err);
  }
}

// 3. Get Deal Room by ID with messages
export async function getConversationById(req, res, next) {
  try {
    const { id } = req.params;
    const conversation = await Conversation.findById(id)
      .populate("productId")
      .populate("demandId")
      .populate("transportOfferId");

    if (!conversation) {
      return res.status(404).json({ error: "Deal room not found" });
    }

    const userId = req.user._id;

    // Check membership
    const membership = await ConversationParticipant.findOne({ conversationId: id, userId });

    // Check compliance inspection grant if not a participant
    let isAuditedComplianceAccess = false;
    if (!membership && req.user.role === "admin") {
      const grantToken = req.headers["x-compliance-grant-token"];
      if (grantToken) {
        const grantTokenHash = crypto.createHash("sha256").update(grantToken).digest("hex");
        const auditLog = await ComplianceAuditLog.findOne({
          conversationId: id,
          adminId: userId,
          grantTokenHash,
          expiresAt: { $gt: new Date() },
        });
        if (auditLog) isAuditedComplianceAccess = true;
      }
    }

    if (!membership && !isAuditedComplianceAccess) {
      return res.status(403).json({
        error: "Access denied to this private deal room. Compliance inspection requires a server-authorized case review grant.",
      });
    }

    const participants = await ConversationParticipant.find({ conversationId: id }).populate(
      "userId",
      "fullName businessName role country city verificationStatus avatarUrl"
    );

    const messages = await Message.find({ conversationId: id })
      .populate("senderId", "fullName businessName role avatarUrl")
      .sort({ createdAt: 1 });

    res.json({
      conversation,
      participants,
      messages,
      auditedAccess: isAuditedComplianceAccess,
    });
  } catch (err) {
    next(err);
  }
}

// 4. Post Message or Quotation
export async function postMessage(req, res, next) {
  try {
    const { id } = req.params;
    const { content, attachmentName, attachmentUrl, attachmentType, attachments, voiceDuration, agreedPrice, agreedQuantity, dealStatus } = req.body;

    if (!content && !attachmentUrl && (!attachments || attachments.length === 0)) {
      return res.status(400).json({ error: "Message content or attachment is required" });
    }

    // Verify participant
    const membership = await ConversationParticipant.findOne({ conversationId: id, userId: req.user._id });
    if (!membership) {
      return res.status(403).json({ error: "You are not a participant in this deal room" });
    }

    const message = await Message.create({
      conversationId: id,
      senderId: req.user._id,
      senderRole: req.user.role,
      content: content ? content.trim() : "Sent an attachment",
      attachmentName: attachmentName || null,
      attachmentUrl: attachmentUrl || null,
      attachmentType: attachmentType || null,
      attachments: attachments || [],
      voiceDuration: voiceDuration != null ? Number(voiceDuration) : null,
    });

    // Update conversation state if terms or quotation updated
    const updates = { updatedAt: new Date() };
    if (dealStatus) updates.dealStatus = dealStatus;
    if (agreedPrice != null) updates.agreedPrice = Number(agreedPrice);
    if (agreedQuantity != null) updates.agreedQuantity = Number(agreedQuantity);

    await Conversation.findByIdAndUpdate(id, updates);

    const populated = await Message.findById(message._id).populate(
      "senderId",
      "fullName businessName role avatarUrl"
    );

    res.status(201).json(populated);
  } catch (err) {
    next(err);
  }
}

// 5. Handle WebRTC Call Signaling
export async function handleSignaling(req, res, next) {
  try {
    const { id } = req.params;
    const { signalType, sdp, candidate } = req.body;

    // Verify participant
    const membership = await ConversationParticipant.findOne({ conversationId: id, userId: req.user._id });
    if (!membership) {
      return res.status(403).json({ error: "Unauthorized call signaling" });
    }

    // Return signaling acknowledgment
    res.json({
      success: true,
      timestamp: Date.now(),
      from: req.user._id,
      signalType,
      sdp,
      candidate,
    });
  } catch (err) {
    next(err);
  }
}
