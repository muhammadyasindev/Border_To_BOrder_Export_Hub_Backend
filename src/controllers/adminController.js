import VerificationDocument from "../models/VerificationDocument.js";
import User from "../models/User.js";
import Conversation from "../models/Conversation.js";
import ComplianceAuditLog from "../models/ComplianceAuditLog.js";
import crypto from "crypto";
import { env } from "../config/env.js";

const COMPLIANCE_GRANT_LIFETIME_MS = 15 * 60 * 1000; // 15 minutes max validity

// 1. Admin Verification Documents List
export async function getAdminVerificationDocs(req, res, next) {
  try {
    const user = req.user;
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Restricted to authorized compliance reviewers" });
    }

    const docs = await VerificationDocument.find()
      .populate("userId", "fullName businessName role country verificationStatus")
      .sort({ submittedAt: -1 });

    const formatted = docs.map((d) => {
      const u = d.userId || {};
      return {
        _id: d._id,
        id: d._id,
        userId: u._id || d.userId,
        documentType: d.documentType,
        documentNumber: d.documentNumber,
        fileName: d.fileName,
        fileUrl: d.fileUrl,
        fileSize: d.fileSize,
        status: d.status,
        reviewerNotes: d.reviewerNotes,
        submittedAt: d.submittedAt,
        userFullName: u.fullName || "",
        userBusinessName: u.businessName || "",
        userRole: u.role || "",
        userCountry: u.country || "",
        userVerificationStatus: u.verificationStatus || "",
      };
    });

    return res.json({ documents: formatted });
  } catch (err) {
    next(err);
  }
}

// 2. Admin Verification Review Decision
export async function reviewVerificationDoc(req, res, next) {
  try {
    const user = req.user;
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Restricted to authorized compliance reviewers" });
    }

    const { docId, targetUserId, action, notes } = req.body;

    if (!docId || !targetUserId || !action) {
      return res.status(400).json({ error: "Missing required review fields" });
    }

    const docStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : "changes_required";
    const userStatus = action === "approve" ? "verified" : action === "reject" ? "rejected" : "changes_required";

    await VerificationDocument.findByIdAndUpdate(docId, {
      status: docStatus,
      reviewerNotes: notes || `Reviewed by Compliance Officer ${user.fullName}`,
      reviewedAt: new Date(),
    });

    await User.findByIdAndUpdate(targetUserId, {
      verificationStatus: userStatus,
      verificationNotes: notes || (action === "approve" ? "Approved by compliance" : "Documentation needs revision"),
      verifiedAt: action === "approve" ? new Date() : null,
      updatedAt: new Date(),
    });

    return res.json({ success: true, message: `Status updated to ${userStatus}` });
  } catch (err) {
    next(err);
  }
}

// 3. Compliance Inspection Grant Authorization
export async function authorizeComplianceGrant(req, res, next) {
  try {
    const user = req.user;
    if (!user || user.role !== "admin") {
      return res.status(403).json({
        error: "Access restricted: Only authorized compliance officers may initiate deal room inspection grants.",
      });
    }

    const { conversationId, caseReference, justification, authorizedBy } = req.body;

    if (!conversationId) {
      return res.status(400).json({ error: "Target conversationId is required" });
    }

    if (!caseReference || caseReference.trim().length < 5) {
      return res.status(400).json({
        error: "Formal case reference required (minimum 5 characters, e.g. DISPUTE-2026-0042)",
      });
    }
    if (!justification || justification.trim().length < 20) {
      return res.status(400).json({
        error: "Substantive legal or trade justification required (minimum 20 characters)",
      });
    }
    if (!authorizedBy || authorizedBy.trim().length < 3) {
      return res.status(400).json({
        error: "Authorizing compliance supervisor/authority required",
      });
    }

    // Verify conversation exists
    const conv = await Conversation.findById(conversationId);
    if (!conv) {
      return res.status(400).json({ error: "Target deal room does not exist" });
    }

    const expiresAt = new Date(Date.now() + COMPLIANCE_GRANT_LIFETIME_MS);
    const secret = env.SESSION_SECRET;

    // Generate ephemeral random token identifier
    const nonce = crypto.randomBytes(16).toString("hex");
    const payload = `${user._id}.${conversationId}.${expiresAt.getTime()}.${nonce}`;
    const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    const grantToken = `${payload}.${hmac}`;
    const grantTokenHash = crypto.createHash("sha256").update(grantToken).digest("hex");

    const forwarded = req.headers["x-forwarded-for"];
    const ipAddress = forwarded ? forwarded.split(",")[0].trim() : req.ip;

    await ComplianceAuditLog.create({
      adminId: user._id,
      conversationId: conv._id,
      caseReference: caseReference.trim(),
      justification: justification.trim(),
      authorizedBy: authorizedBy.trim(),
      action: "inspection_access",
      ipAddress: ipAddress || null,
      grantTokenHash,
      expiresAt,
    });

    return res.json({
      success: true,
      message: "Compliance audit case durably recorded. Temporary inspection token issued.",
      grantToken,
      expiresAt,
      caseReference,
    });
  } catch (err) {
    next(err);
  }
}
