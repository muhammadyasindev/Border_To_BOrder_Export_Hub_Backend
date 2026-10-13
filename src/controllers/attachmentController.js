import fs from "fs";
import { getAttachmentRecord, getAttachmentFilePath } from "../utils/attachments.js";
import ConversationParticipant from "../models/ConversationParticipant.js";

export async function getAttachment(req, res, next) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;
    const record = getAttachmentRecord(id);

    if (!record) {
      return res.status(404).json({ error: "Attachment not found" });
    }

    // Strict resource-level authorization: User must be a participant in the conversation or admin
    if (user.role !== "admin") {
      const membership = await ConversationParticipant.findOne({
        conversationId: record.conversationId,
        userId: user._id,
      });

      if (!membership) {
        return res.status(403).json({ error: "Access denied to this private trade document" });
      }
    }

    const filePath = getAttachmentFilePath(record.storageName);
    if (!filePath) {
      return res.status(404).json({ error: "Attachment file missing from storage" });
    }

    const fileBuffer = fs.readFileSync(filePath);

    res.set({
      "Content-Type": record.mime || "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(record.filename)}"`,
      "Content-Length": fileBuffer.length.toString(),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-cache, no-store, must-revalidate",
    });

    return res.status(200).send(fileBuffer);
  } catch (error) {
    next(error);
  }
}
