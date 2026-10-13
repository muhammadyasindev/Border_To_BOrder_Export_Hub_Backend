import fs from "fs";
import path from "path";
import crypto from "crypto";

const ATTACHMENT_DIR = process.env.ATTACHMENT_STORAGE_DIR
  ? path.resolve(process.env.ATTACHMENT_STORAGE_DIR)
  : path.resolve(process.cwd(), "data", "attachments");
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

// Ensure private attachment storage directory exists
if (!fs.existsSync(ATTACHMENT_DIR)) {
  fs.mkdirSync(ATTACHMENT_DIR, { recursive: true });
}

// Map to store attachment records for authorization lookup
const attachmentStoreFile = path.join(ATTACHMENT_DIR, "index.json");

export function loadAttachmentIndex() {
  try {
    if (fs.existsSync(attachmentStoreFile)) {
      return JSON.parse(fs.readFileSync(attachmentStoreFile, "utf-8"));
    }
  } catch (e) {}
  return {};
}

export function saveAttachmentIndex(index) {
  try {
    fs.writeFileSync(attachmentStoreFile, JSON.stringify(index, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to write attachment index:", e);
  }
}

/**
 * Validates file buffer against known permitted magic bytes / signatures:
 * - PDF (%PDF)
 * - PNG (\x89PNG\r\n\x1a\n)
 * - JPEG (\xFF\xD8\xFF)
 * - WEBP (RIFF....WEBP)
 * - WebM audio/video (\x1A\x45\xDF\xA3)
 * - Ogg audio (OggS)
 */
export function validateFileSignature(buffer) {
  if (buffer.length < 4) {
    return { valid: false, detectedMime: "unknown", extension: "" };
  }

  // 1. PDF: 25 50 44 46 (%PDF)
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return { valid: true, detectedMime: "application/pdf", extension: "pdf" };
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  ) {
    return { valid: true, detectedMime: "image/png", extension: "png" };
  }

  // 3. JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { valid: true, detectedMime: "image/jpeg", extension: "jpg" };
  }

  // 4. WEBP: 52 49 46 46 (RIFF) ... 57 45 42 50 (WEBP)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { valid: true, detectedMime: "image/webp", extension: "webp" };
  }

  // 5. WebM (Matroska container): 1A 45 DF A3
  if (buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3) {
    return { valid: true, detectedMime: "audio/webm", extension: "webm" };
  }

  // 6. Ogg Audio: 4F 67 67 53 (OggS)
  if (buffer[0] === 0x4F && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) {
    return { valid: true, detectedMime: "audio/ogg", extension: "ogg" };
  }

  return { valid: false, detectedMime: "application/octet-stream", extension: "bin" };
}

/**
 * Heuristic exploit scanner for uploaded documents.
 */
export function scanBufferForActiveThreats(buffer, detectedMime) {
  if (detectedMime === "application/pdf") {
    const rawContent = buffer.toString("binary");
    
    if (rawContent.includes("/JavaScript") || rawContent.includes("/JS") || rawContent.includes("/Launch")) {
      return {
        clean: false,
        reason: "Security Violation: Document contains embedded executable script or launch actions, which are prohibited.",
      };
    }

    if (rawContent.includes("/OpenAction") && (rawContent.includes("/SubmitForm") || rawContent.includes("/ImportData"))) {
      return {
        clean: false,
        reason: "Security Violation: Document contains automated external submission actions.",
      };
    }
  }

  const mzIndex = buffer.indexOf("MZ");
  if (mzIndex !== -1 && mzIndex < 512 && detectedMime !== "image/jpeg" && detectedMime !== "image/png") {
    return {
      clean: false,
      reason: "Security Violation: File contains hidden Windows executable binary headers.",
    };
  }

  return { clean: true };
}

export function sanitizeFileName(filename) {
  const base = path.basename(filename || "unnamed");
  return base.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * Process and safely store an attachment payload
 */
export async function processAndStoreAttachment(item, conversationId, uploaderId) {
  try {
    let fileBuffer;

    if (item.buffer) {
      fileBuffer = item.buffer;
    } else {
      const dataStr = item.dataUrl || item.url || "";
      if (dataStr.startsWith("data:")) {
        const parts = dataStr.split(",");
        const base64Data = parts[1];
        if (!base64Data || base64Data.trim().length === 0) {
          return { success: false, error: "Invalid data URL format: missing payload" };
        }
        const cleanBase64 = base64Data.trim();
        if (!/^[A-Za-z0-9+/=]+$/.test(cleanBase64)) {
          return { success: false, error: "Malformed base64 character encoding" };
        }
        fileBuffer = Buffer.from(cleanBase64, "base64");
        if (fileBuffer.length === 0) {
          return { success: false, error: "Attachment payload is empty" };
        }
      } else {
        return {
          success: true,
          attachment: {
            id: crypto.randomUUID(),
            name: sanitizeFileName(item.name),
            size: "1.0 MB",
            type: (item.name && item.name.endsWith(".pdf")) ? "pdf" : "image",
            mime: (item.name && item.name.endsWith(".pdf")) ? "application/pdf" : "image/jpeg",
            url: dataStr,
          },
        };
      }
    }

    if (fileBuffer.length > MAX_FILE_SIZE) {
      return { success: false, error: `File exceeds maximum allowed size of 15MB (${(fileBuffer.length / (1024 * 1024)).toFixed(1)}MB)` };
    }

    const { valid, detectedMime, extension } = validateFileSignature(fileBuffer);
    if (!valid) {
      return { success: false, error: "Forbidden file type. Only PDF documents, JPEG/PNG/WEBP images, and WebM voice notes are permitted." };
    }

    const threatScan = scanBufferForActiveThreats(fileBuffer, detectedMime);
    if (!threatScan.clean) {
      return { success: false, error: threatScan.reason || "File quarantined due to detected security violation." };
    }

    const fileId = crypto.randomUUID();
    const storageName = `${fileId}.${extension}`;
    const storagePath = path.join(ATTACHMENT_DIR, storageName);

    fs.writeFileSync(storagePath, fileBuffer);

    const safeName = sanitizeFileName(item.name || `document_${fileId.slice(0, 8)}.${extension}`);
    const sizeStr = (fileBuffer.length / (1024 * 1024)).toFixed(2) + " MB";

    const index = loadAttachmentIndex();
    index[fileId] = {
      conversationId: String(conversationId),
      uploaderId: String(uploaderId),
      filename: safeName,
      mime: detectedMime,
      storageName,
    };
    saveAttachmentIndex(index);

    return {
      success: true,
      attachment: {
        id: fileId,
        name: safeName,
        size: sizeStr,
        type: detectedMime.startsWith("image") ? "image" : detectedMime.startsWith("audio") ? "voice_note" : "pdf",
        mime: detectedMime,
        url: `/api/attachments/${fileId}`,
      },
    };
  } catch (err) {
    return { success: false, error: err.message || "Failed to process attachment" };
  }
}

export function getAttachmentRecord(id) {
  const index = loadAttachmentIndex();
  return index[id] || null;
}

export function getAttachmentFilePath(storageName) {
  const cleanName = path.basename(storageName);
  const fullPath = path.join(ATTACHMENT_DIR, cleanName);
  if (fs.existsSync(fullPath)) {
    return fullPath;
  }
  return null;
}
