import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import ConversationParticipant from "../models/ConversationParticipant.js";
import Message from "../models/Message.js";
import Product from "../models/Product.js";
import BuyerDemand from "../models/BuyerDemand.js";
import TransportOffer from "../models/TransportOffer.js";
import ProductOffer from "../models/ProductOffer.js";
import TransportRequest from "../models/TransportRequest.js";
import ComplianceAuditLog from "../models/ComplianceAuditLog.js";
import User from "../models/User.js";
import { sendNotification } from "../utils/notificationHelper.js";
import crypto from "crypto";

// 1. Get User Conversations
export async function getConversations(req, res, next) {
  try {
    if (!req.user) {
      return res.json([]);
    }
    const userId = req.user._id;

    // Find all conversation IDs where user is participant
    const memberships = await ConversationParticipant.find({ userId }).select("conversationId roleInDeal");
    const conversationIds = memberships.map((m) => m.conversationId);

    const conversations = await Conversation.find({ _id: { $in: conversationIds } })
      .populate("productId", "title category pricePerUnit currency imageUrl originCountry originCity")
      .populate("productOfferId", "title offerPrice originalPrice discountValue discountType currency")
      .populate("demandId", "title category targetPrice currency destinationCountry destinationCity")
      .populate("transportOfferId", "title originCorridor destinationCorridor ratePerKmOrTrip currency")
      .populate("transportRequestId", "title cargoCategory quantity unit pickupCountry destinationCountry offeredBudget currency")
      .sort({ updatedAt: -1 });

    // Fetch participants for each conversation
    const result = await Promise.all(
      conversations.map(async (c) => {
        const parts = await ConversationParticipant.find({ conversationId: c._id }).populate(
          "userId",
          "fullName businessName role country city verificationStatus avatarUrl phone"
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

// 2. Create Deal Room Conversation (With Duplicate Prevention & Auto-Recipient Resolution)
export async function createConversation(req, res, next) {
  try {
    const {
      title,
      recipientId,
      dealSubjectType = "general",
      productId,
      productOfferId,
      demandId,
      transportOfferId,
      transportRequestId,
      initialMessage,
    } = req.body;

    let effectiveRecipientId = recipientId || req.body.targetUserId;
    if (effectiveRecipientId && typeof effectiveRecipientId === "object") {
      effectiveRecipientId = effectiveRecipientId._id || effectiveRecipientId.id;
    }
    if (typeof effectiveRecipientId === "string") {
      effectiveRecipientId = effectiveRecipientId.trim();
      if (
        effectiveRecipientId === "[object Object]" ||
        effectiveRecipientId === "undefined" ||
        effectiveRecipientId === "null" ||
        effectiveRecipientId === ""
      ) {
        effectiveRecipientId = null;
      }
    }

    // Auto-resolve recipient if missing or unpopulated from referenced item
    if (!effectiveRecipientId || !mongoose.Types.ObjectId.isValid(effectiveRecipientId)) {
      if (transportOfferId && mongoose.Types.ObjectId.isValid(transportOfferId)) {
        const tOffer = await TransportOffer.findById(transportOfferId);
        if (tOffer?.driverId) effectiveRecipientId = tOffer.driverId.toString();
      } else if (productId && mongoose.Types.ObjectId.isValid(productId)) {
        const prod = await Product.findById(productId);
        if (prod?.exporterId) effectiveRecipientId = prod.exporterId.toString();
      } else if (productOfferId && mongoose.Types.ObjectId.isValid(productOfferId)) {
        const pOffer = await ProductOffer.findById(productOfferId);
        if (pOffer?.exporterId) effectiveRecipientId = pOffer.exporterId.toString();
      } else if (demandId && mongoose.Types.ObjectId.isValid(demandId)) {
        const dem = await BuyerDemand.findById(demandId);
        if (dem?.buyerId) effectiveRecipientId = dem.buyerId.toString();
      } else if (transportRequestId && mongoose.Types.ObjectId.isValid(transportRequestId)) {
        const tReq = await TransportRequest.findById(transportRequestId);
        if (tReq?.requesterId) effectiveRecipientId = tReq.requesterId.toString();
      }
    }

    if (!effectiveRecipientId || !mongoose.Types.ObjectId.isValid(effectiveRecipientId)) {
      return res.status(400).json({ error: "A valid counterparty or target listing is required to create a deal room" });
    }

    const currentUserId = req.user._id;

    // Duplicate Prevention Check:
    // Look for an existing conversation between current user and recipient for this exact item
    const existingParticipants = await ConversationParticipant.find({
      userId: currentUserId,
    });
    const candidateConversationIds = existingParticipants.map((p) => p.conversationId);

    const otherParticipants = await ConversationParticipant.find({
      conversationId: { $in: candidateConversationIds },
      userId: effectiveRecipientId,
    });
    const sharedConversationIds = otherParticipants.map((p) => p.conversationId);

    if (sharedConversationIds.length > 0) {
      const matchFilter = {
        _id: { $in: sharedConversationIds },
        dealStatus: { $ne: "cancelled" },
      };

      if (productId && mongoose.Types.ObjectId.isValid(productId)) matchFilter.productId = productId;
      else if (productOfferId && mongoose.Types.ObjectId.isValid(productOfferId)) matchFilter.productOfferId = productOfferId;
      else if (demandId && mongoose.Types.ObjectId.isValid(demandId)) matchFilter.demandId = demandId;
      else if (transportOfferId && mongoose.Types.ObjectId.isValid(transportOfferId)) matchFilter.transportOfferId = transportOfferId;
      else if (transportRequestId && mongoose.Types.ObjectId.isValid(transportRequestId)) matchFilter.transportRequestId = transportRequestId;

      const existingConvo = await Conversation.findOne(matchFilter);
      if (existingConvo) {
        if (initialMessage && initialMessage.trim()) {
          await Message.create({
            conversationId: existingConvo._id,
            senderId: currentUserId,
            senderRole: req.user.role,
            content: initialMessage.trim(),
          });
          existingConvo.updatedAt = new Date();
          await existingConvo.save();
        }
        const cJson = existingConvo.toJSON ? existingConvo.toJSON() : existingConvo;
        return res.json({
          conversation: existingConvo,
          id: existingConvo._id,
          _id: existingConvo._id,
          ...cJson,
        });
      }
    }

    // Determine roles in deal
    let senderRoleInDeal = "buyer";
    if (req.user.role === "exporter") senderRoleInDeal = "exporter";
    else if (req.user.role === "driver") senderRoleInDeal = "transporter";

    let recipientRoleInDeal = "exporter";
    if (dealSubjectType === "demand") recipientRoleInDeal = "buyer";
    else if (dealSubjectType === "transport" || dealSubjectType === "transport_request") recipientRoleInDeal = "transporter";

    const conversation = await Conversation.create({
      title: (title || "Commercial Deal Room").trim(),
      dealSubjectType,
      productId: productId && mongoose.Types.ObjectId.isValid(productId) ? productId : null,
      productOfferId: productOfferId && mongoose.Types.ObjectId.isValid(productOfferId) ? productOfferId : null,
      demandId: demandId && mongoose.Types.ObjectId.isValid(demandId) ? demandId : null,
      transportOfferId: transportOfferId && mongoose.Types.ObjectId.isValid(transportOfferId) ? transportOfferId : null,
      transportRequestId: transportRequestId && mongoose.Types.ObjectId.isValid(transportRequestId) ? transportRequestId : null,
      dealStatus: "inquiry",
    });

    // Add current user participant
    await ConversationParticipant.create({
      conversationId: conversation._id,
      userId: currentUserId,
      roleInDeal: senderRoleInDeal,
    });

    // Add recipient participant if not current user
    if (String(effectiveRecipientId) !== String(currentUserId)) {
      await ConversationParticipant.create({
        conversationId: conversation._id,
        userId: effectiveRecipientId,
        roleInDeal: recipientRoleInDeal,
      });

      // Server-side notification to recipient
      await sendNotification({
        userId: effectiveRecipientId,
        title: "New Deal Room Inquiry",
        message: `${req.user.fullName || "A trade participant"} initiated a deal room: "${title || "Deal Room"}".`,
        link: `/conversations/${conversation._id}`,
      });
    }

    if (initialMessage && initialMessage.trim()) {
      await Message.create({
        conversationId: conversation._id,
        senderId: currentUserId,
        senderRole: req.user.role,
        content: initialMessage.trim(),
      });
    }

    const populated = await Conversation.findById(conversation._id)
      .populate("productId")
      .populate("productOfferId")
      .populate("demandId")
      .populate("transportOfferId")
      .populate("transportRequestId");

    const pJson = populated.toJSON ? populated.toJSON() : populated;
    res.status(201).json({
      conversation: populated,
      id: populated._id,
      _id: populated._id,
      ...pJson,
    });
  } catch (err) {
    next(err);
  }
}

// 3. Get Deal Room by ID with messages and context
export async function getConversationById(req, res, next) {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: "Invalid deal room ID" });
    }
    const conversation = await Conversation.findById(id)
      .populate("productId")
      .populate("productOfferId")
      .populate("demandId")
      .populate("transportOfferId")
      .populate("transportRequestId");

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
        error: "Access denied to this private deal room.",
      });
    }

    const participants = await ConversationParticipant.find({ conversationId: id }).populate(
      "userId",
      "fullName businessName role country city verificationStatus avatarUrl phone"
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

// 4. Post Message in Deal Room
export async function postMessage(req, res, next) {
  try {
    const { id } = req.params;
    const { content, attachmentName, attachmentUrl, attachmentType, attachments, voiceDuration, messageType = "chat", proposalData } = req.body;

    if (!content && !attachmentUrl && (!attachments || attachments.length === 0) && !proposalData) {
      return res.status(400).json({ error: "Message content, attachment, or proposal is required" });
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
      messageType,
      proposalData: proposalData || null,
      attachmentName: attachmentName || null,
      attachmentUrl: attachmentUrl || null,
      attachmentType: attachmentType || null,
      attachments: attachments || [],
      voiceDuration: voiceDuration != null ? Number(voiceDuration) : null,
    });

    await Conversation.findByIdAndUpdate(id, { updatedAt: new Date() });

    const populated = await Message.findById(message._id).populate(
      "senderId",
      "fullName businessName role avatarUrl"
    );

    // Notify other participants
    const otherParticipants = await ConversationParticipant.find({
      conversationId: id,
      userId: { $ne: req.user._id },
    });

    for (const p of otherParticipants) {
      await sendNotification({
        userId: p.userId,
        title: "New Message in Deal Room",
        message: `${req.user.fullName || "Partner"}: "${(content || "Sent an update").slice(0, 60)}"`,
        link: `/conversations/${id}`,
      });
    }

    res.status(201).json(populated);
  } catch (err) {
    next(err);
  }
}

// 5. Submit Quotation or Counteroffer (Requirement 3 & 7)
export async function submitProposal(req, res, next) {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid conversation ID" });
    }
    const { price, quantity, currency = "USD", deliveryDate, route, paymentTerms, notes } = req.body;

    if (price == null || quantity == null) {
      return res.status(400).json({ error: "price and quantity are required for a quotation" });
    }

    const membership = await ConversationParticipant.findOne({ conversationId: id, userId: req.user._id });
    if (!membership) return res.status(403).json({ error: "Unauthorized" });

    const conversation = await Conversation.findById(id);
    if (!conversation) return res.status(404).json({ error: "Deal room not found" });

    const isCounter = !!conversation.currentProposal?.price;
    const actionType = isCounter ? "counteroffer" : "quotation";

    const proposalObj = {
      proposerId: req.user._id,
      price: Number(price),
      quantity: Number(quantity),
      currency: currency || conversation.currency || "USD",
      deliveryDate: deliveryDate || "Within agreed corridor transit window",
      route: route || "Direct corridor transit",
      paymentTerms: paymentTerms || "Letter of Credit / Border Inspection Escrow",
      status: "awaiting_confirmation",
      confirmations: [req.user._id],
      updatedAt: new Date(),
    };

    conversation.currentProposal = proposalObj;
    conversation.proposalHistory.push({
      ...proposalObj,
      createdAt: new Date(),
    });
    conversation.confirmationHistory.push({
      userId: req.user._id,
      role: req.user.role,
      action: isCounter ? "countered" : "proposed",
      proposalSnapshot: proposalObj,
      timestamp: new Date(),
      note: notes || null,
    });
    conversation.dealStatus = "awaiting_confirmation";
    await conversation.save();

    // Post an audit message in the conversation feed
    const summaryText = `${isCounter ? "Counteroffer submitted" : "Formal quotation submitted"}: ${proposalObj.currency} ${Number(price).toLocaleString()} for ${quantity} units. Terms: ${paymentTerms || "Standard"}. ${notes ? `Note: ${notes}` : ""}`;

    const message = await Message.create({
      conversationId: id,
      senderId: req.user._id,
      senderRole: req.user.role,
      content: summaryText,
      messageType: actionType,
      proposalData: {
        price: Number(price),
        quantity: Number(quantity),
        currency: proposalObj.currency,
        deliveryDate,
        route,
        paymentTerms,
        action: actionType,
      },
    });

    // Notify other participants
    const otherParticipants = await ConversationParticipant.find({
      conversationId: id,
      userId: { $ne: req.user._id },
    });

    for (const p of otherParticipants) {
      await sendNotification({
        userId: p.userId,
        title: isCounter ? "New Counteroffer Received" : "New Quotation Received",
        message: `${req.user.fullName || "Partner"} offered ${proposalObj.currency} ${Number(price).toLocaleString()} for ${quantity} units.`,
        link: `/conversations/${id}`,
      });
    }

    res.status(201).json({
      success: true,
      conversation,
      proposal: conversation.currentProposal,
      message,
    });
  } catch (err) {
    next(err);
  }
}

// 6. Respond to Proposal (Accept, Confirm, or Reject with Mutual Confirmation & Marketplace Deduction)
export async function respondProposal(req, res, next) {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid conversation ID" });
    }
    const { action } = req.body; // "accept" or "reject" or "confirm"

    if (!["accept", "reject", "confirm"].includes(action)) {
      return res.status(400).json({ error: "action must be 'accept', 'reject', or 'confirm'" });
    }

    const membership = await ConversationParticipant.findOne({ conversationId: id, userId: req.user._id });
    if (!membership) return res.status(403).json({ error: "Unauthorized" });

    const conversation = await Conversation.findById(id);
    if (!conversation || !conversation.currentProposal?.price) {
      return res.status(404).json({ error: "No active quotation to respond to" });
    }

    if (String(conversation.currentProposal.proposerId) === String(req.user._id)) {
      return res.status(400).json({ error: "You cannot accept or reject your own quotation" });
    }

    if (conversation.currentProposal.status === "confirmed" && conversation.dealStatus === "confirmed") {
      return res.status(400).json({ error: "This deal has already been confirmed." });
    }

    if (action === "reject") {
      conversation.currentProposal.status = "rejected";
      conversation.dealStatus = "rejected";
      conversation.confirmationHistory.push({
        userId: req.user._id,
        role: req.user.role,
        action: "rejected",
        proposalSnapshot: conversation.currentProposal,
        timestamp: new Date(),
      });
      await conversation.save();

      const auditText = `Quotation declined by ${req.user.fullName || "Partner"}. Negotiations remain open for counteroffer.`;
      const message = await Message.create({
        conversationId: id,
        senderId: req.user._id,
        senderRole: req.user.role,
        content: auditText,
        messageType: "rejection",
        proposalData: {
          price: conversation.currentProposal.price,
          quantity: conversation.currentProposal.quantity,
          currency: conversation.currentProposal.currency,
          action: "rejected",
        },
      });

      const otherParticipants = await ConversationParticipant.find({
        conversationId: id,
        userId: { $ne: req.user._id },
      });
      for (const p of otherParticipants) {
        await sendNotification({
          userId: p.userId,
          title: "Proposal Declined",
          message: auditText,
          link: `/conversations/${id}`,
        });
      }

      return res.json({ success: true, conversation, proposal: conversation.currentProposal, message });
    }

    // Action is "accept" or "confirm"
    if (!conversation.currentProposal.confirmations) {
      conversation.currentProposal.confirmations = [];
    }
    if (!conversation.currentProposal.confirmations.some((uid) => String(uid) === String(req.user._id))) {
      conversation.currentProposal.confirmations.push(req.user._id);
    }
    if (
      conversation.currentProposal.proposerId &&
      !conversation.currentProposal.confirmations.some((uid) => String(uid) === String(conversation.currentProposal.proposerId))
    ) {
      conversation.currentProposal.confirmations.push(conversation.currentProposal.proposerId);
    }

    const allParticipants = await ConversationParticipant.find({ conversationId: id });
    const participantUserIds = allParticipants.map((p) => String(p.userId));
    const confirmedUserIds = conversation.currentProposal.confirmations.map((c) => String(c));

    const isFullyConfirmed =
      participantUserIds.every((uid) => confirmedUserIds.includes(uid)) || confirmedUserIds.length >= 2;

    if (isFullyConfirmed) {
      conversation.currentProposal.status = "confirmed";
      conversation.dealStatus = "confirmed";
      conversation.agreedPrice = conversation.currentProposal.price;
      conversation.agreedQuantity = conversation.currentProposal.quantity;
      conversation.currency = conversation.currentProposal.currency;
    } else {
      conversation.currentProposal.status = "awaiting_confirmation";
      conversation.dealStatus = "awaiting_confirmation";
    }

    conversation.confirmationHistory.push({
      userId: req.user._id,
      role: req.user.role,
      action: isFullyConfirmed ? "confirmed" : "accepted",
      proposalSnapshot: conversation.currentProposal,
      timestamp: new Date(),
    });

    await conversation.save();

    // REQUIREMENT 4: Deduct available quantity or vehicle capacity upon deal confirmation
    if (isFullyConfirmed) {
      const agreedQty = Number(conversation.agreedQuantity) || 0;

      // 1. Product & Product Offer deduction
      if (conversation.productId) {
        const prod = await Product.findById(conversation.productId);
        if (prod) {
          prod.quantityAvailable = Math.max(0, (prod.quantityAvailable || 0) - agreedQty);
          if (prod.quantityAvailable <= 0) {
            prod.status = "closed";
          }
          await prod.save();

          if (prod.quantityAvailable <= 0) {
            await ProductOffer.updateMany(
              { productId: prod._id, status: "active" },
              { $set: { status: "fulfilled" } }
            );
          }
        }
      }

      if (conversation.productOfferId) {
        const pOffer = await ProductOffer.findById(conversation.productOfferId);
        if (pOffer) {
          if (pOffer.productId) {
            const parentProd = await Product.findById(pOffer.productId);
            if (parentProd) {
              parentProd.quantityAvailable = Math.max(0, (parentProd.quantityAvailable || 0) - agreedQty);
              if (parentProd.quantityAvailable <= 0) {
                parentProd.status = "closed";
                pOffer.status = "fulfilled";
              }
              await parentProd.save();
            }
          }
          await pOffer.save();
        }
      }

      // 2. Buyer Demand deduction
      if (conversation.demandId) {
        const dem = await BuyerDemand.findById(conversation.demandId);
        if (dem) {
          dem.quantityRequired = Math.max(0, (dem.quantityRequired || 0) - agreedQty);
          if (dem.quantityRequired <= 0) {
            dem.status = "fulfilled";
          }
          await dem.save();
        }
      }

      // 3. Transport Offer capacity deduction
      if (conversation.transportOfferId) {
        const tOffer = await TransportOffer.findById(conversation.transportOfferId);
        if (tOffer) {
          if (agreedQty > 0) {
            tOffer.availableCapacityTons = Math.max(0, (tOffer.availableCapacityTons || 0) - agreedQty);
          }
          if (tOffer.availableCapacityTons <= 0) {
            tOffer.status = "booked";
          }
          await tOffer.save();
        }
      }

      // 4. Transport Request fulfillment
      if (conversation.transportRequestId) {
        const tReq = await TransportRequest.findById(conversation.transportRequestId);
        if (tReq) {
          tReq.status = "booked";
          await tReq.save();
        }
      }
    }

    const auditText = isFullyConfirmed
      ? `🎉 DEAL CONFIRMED! Mutual agreement established by all authorized parties. Final Terms: ${conversation.currency} ${Number(conversation.agreedPrice).toLocaleString()} for ${conversation.agreedQuantity} units.`
      : `Quotation accepted by ${req.user.fullName || "Partner"}. Awaiting final confirmation.`;

    const message = await Message.create({
      conversationId: id,
      senderId: req.user._id,
      senderRole: req.user.role,
      content: auditText,
      messageType: isFullyConfirmed ? "confirmation" : "acceptance",
      proposalData: {
        price: conversation.currentProposal.price,
        quantity: conversation.currentProposal.quantity,
        currency: conversation.currentProposal.currency,
        action: isFullyConfirmed ? "confirmed" : "accepted",
      },
    });

    const otherParticipants = await ConversationParticipant.find({
      conversationId: id,
      userId: { $ne: req.user._id },
    });

    for (const p of otherParticipants) {
      await sendNotification({
        userId: p.userId,
        title: isFullyConfirmed ? "Deal Confirmed!" : "Proposal Accepted",
        message: auditText,
        link: `/conversations/${id}`,
      });
    }

    res.json({
      success: true,
      isFullyConfirmed,
      conversation,
      proposal: conversation.currentProposal,
      message,
    });
  } catch (err) {
    next(err);
  }
}

// 7. Handle WebRTC Call Signaling
export async function handleSignaling(req, res, next) {
  try {
    const { id } = req.params;
    const { signalType, sdp, candidate } = req.body;

    const membership = await ConversationParticipant.findOne({ conversationId: id, userId: req.user._id });
    if (!membership) {
      return res.status(403).json({ error: "Unauthorized call signaling" });
    }

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

// In-memory call sessions for WebRTC signaling
const activeCallSessions = new Map();

// 8. Update Deal Room (Status or Invite Participant)
export async function updateConversation(req, res, next) {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid deal room ID" });
    }
    const { action, dealStatus, agreedPrice, agreedQuantity, newParticipantId, newParticipantRole } = req.body;

    const membership = await ConversationParticipant.findOne({ conversationId: id, userId: req.user._id });
    if (!membership && req.user.role !== "admin") {
      return res.status(403).json({ error: "Access denied to this deal room" });
    }

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({ error: "Deal room not found" });
    }

    if (action === "invite_participant") {
      if (!newParticipantId || !mongoose.Types.ObjectId.isValid(newParticipantId)) {
        return res.status(400).json({ error: "Valid newParticipantId is required" });
      }

      const existing = await ConversationParticipant.findOne({
        conversationId: id,
        userId: newParticipantId,
      });

      if (!existing) {
        const targetUser = await User.findById(newParticipantId);
        const resolvedRole = newParticipantRole || targetUser?.role || "partner";

        await ConversationParticipant.create({
          conversationId: id,
          userId: newParticipantId,
          roleInDeal: resolvedRole,
        });

        let inviteAnnouncement = `🤝 ${targetUser?.fullName || 'Commercial Partner'} (${targetUser?.businessName || resolvedRole.toUpperCase()}) has been invited to this deal room by ${req.user.fullName || 'Trade Partner'}.`;
        if (resolvedRole === "driver" || resolvedRole === "transporter") {
          inviteAnnouncement = `🚛 Transporter ${targetUser?.fullName || 'Driver'} has been invited to coordinate cross-border logistics and convoy dispatch.`;
          conversation.dealStatus = "transporter_invited";
        } else if (resolvedRole === "exporter") {
          inviteAnnouncement = `📦 Exporter ${targetUser?.fullName || 'Supplier'} (${targetUser?.businessName || 'Trade Entity'}) has joined to provide export consignment documentation.`;
        } else if (resolvedRole === "importer") {
          inviteAnnouncement = `🏢 Importer / Buyer ${targetUser?.fullName || 'Buyer'} (${targetUser?.businessName || 'Trade Entity'}) has joined to review commercial terms.`;
        }

        await Message.create({
          conversationId: id,
          senderId: req.user._id,
          senderRole: req.user.role,
          content: inviteAnnouncement,
        });

        conversation.updatedAt = new Date();
        await conversation.save();

        await sendNotification({
          userId: newParticipantId,
          title: "Invited to Deal Room",
          message: `${req.user.fullName || "A partner"} invited you to join deal room: "${conversation.title}".`,
          link: `/conversations/${id}`,
        });
      }

      return res.json({ success: true, message: "Participant invited" });
    }

    if (dealStatus) {
      const prevStatus = conversation.dealStatus;

      // If cancelling a previously confirmed deal, restore stock / vehicle capacity
      if (dealStatus === "cancelled" && prevStatus === "confirmed") {
        const agreedQty = Number(conversation.agreedQuantity) || 0;
        if (conversation.productId && agreedQty > 0) {
          const prod = await Product.findById(conversation.productId);
          if (prod) {
            prod.quantityAvailable += agreedQty;
            if (prod.status === "closed") prod.status = "active";
            await prod.save();
          }
        }
        if (conversation.transportOfferId && agreedQty > 0) {
          const tOffer = await TransportOffer.findById(conversation.transportOfferId);
          if (tOffer) {
            tOffer.availableCapacityTons += agreedQty;
            if (tOffer.status === "booked") tOffer.status = "active";
            await tOffer.save();
          }
        }
        if (conversation.demandId && agreedQty > 0) {
          const dem = await BuyerDemand.findById(conversation.demandId);
          if (dem) {
            dem.quantityRequired += agreedQty;
            if (dem.status === "fulfilled") dem.status = "active";
            await dem.save();
          }
        }
        if (conversation.transportRequestId) {
          const tReq = await TransportRequest.findById(conversation.transportRequestId);
          if (tReq) {
            if (tReq.status === "booked") tReq.status = "active";
            await tReq.save();
          }
        }
      }

      conversation.dealStatus = dealStatus;
      if (agreedPrice != null && agreedPrice !== "") {
        conversation.agreedPrice = Number(agreedPrice);
      }
      if (agreedQuantity != null && agreedQuantity !== "") {
        conversation.agreedQuantity = Number(agreedQuantity);
      }
      conversation.updatedAt = new Date();
      await conversation.save();

      await Message.create({
        conversationId: id,
        senderId: req.user._id,
        senderRole: req.user.role,
        content: `Deal milestone updated to: ${dealStatus.replace(/_/g, " ").toUpperCase()}${agreedPrice ? ` (Agreed Price: USD ${Number(agreedPrice).toLocaleString()})` : ""}`,
      });

      return res.json({ success: true, conversation });
    }

    res.json({ success: true, conversation });
  } catch (err) {
    next(err);
  }
}

// 9. Get WebRTC Call Session
export async function getCallSession(req, res, next) {
  try {
    const { id } = req.params;
    const membership = await ConversationParticipant.findOne({ conversationId: id, userId: req.user._id });
    if (!membership && req.user.role !== "admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    const session = activeCallSessions.get(String(id));
    res.json({
      call: session || { status: "idle", conversationId: id },
    });
  } catch (err) {
    next(err);
  }
}

// 10. Handle WebRTC Call Actions (Initiate, Answer, Candidate, End/Reject)
export async function handleCallAction(req, res, next) {
  try {
    const { id } = req.params;
    const membership = await ConversationParticipant.findOne({ conversationId: id, userId: req.user._id });
    if (!membership && req.user.role !== "admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    const { action, callType, offerSdp, answerSdp, candidate } = req.body;
    const convKey = String(id);
    let session = activeCallSessions.get(convKey);

    if (action === "initiate") {
      session = {
        conversationId: id,
        callType: callType || "voice",
        status: "ringing",
        callerId: req.user._id,
        callerName: req.user.fullName || "Trade Partner",
        callerRole: req.user.role,
        offerSdp: offerSdp || null,
        iceCandidates: [],
        startedAt: Date.now(),
      };
      activeCallSessions.set(convKey, session);
      return res.json({ success: true, call: session });
    }

    if (action === "answer") {
      if (!session) {
        return res.status(400).json({ error: "No active call session to answer" });
      }
      session.status = "connected";
      session.answerSdp = answerSdp || session.answerSdp;
      session.connectedAt = Date.now();
      activeCallSessions.set(convKey, session);
      return res.json({ success: true, call: session });
    }

    if (action === "candidate") {
      if (!session) {
        return res.status(400).json({ error: "No active call session" });
      }
      if (candidate) {
        session.iceCandidates.push({
          candidate,
          senderId: req.user._id,
        });
      }
      return res.json({ success: true });
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

        await Message.create({
          conversationId: id,
          senderId: req.user._id,
          senderRole: req.user.role,
          content: `${callIcon} ${callLabel} ${action === "reject" ? "Declined" : "Ended"} (${durationStr})`,
        });

        session.status = action === "reject" ? "rejected" : "ended";
        session.endedAt = Date.now();

        setTimeout(() => {
          activeCallSessions.delete(convKey);
        }, 4000);
      }
      return res.json({ success: true, status: "ended", call: { status: "ended" } });
    }

    return res.status(400).json({ error: "Invalid call action" });
  } catch (err) {
    next(err);
  }
}
