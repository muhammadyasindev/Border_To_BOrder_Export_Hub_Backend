import crypto from "crypto";
import { db } from "@/db";
import { complianceAuditLogs, users, conversations } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { getSessionSecret } from "@/lib/auth";

const COMPLIANCE_GRANT_LIFETIME_MS = 15 * 60 * 1000; // 15 minutes max validity

/**
 * Creates a server-authorized, durably logged compliance inspection grant.
 */
export async function createComplianceGrant(params: {
  adminId: number;
  conversationId: number;
  caseReference: string;
  justification: string;
  authorizedBy: string;
  ipAddress?: string;
}): Promise<{ success: boolean; grantToken?: string; expiresAt?: Date; error?: string }> {
  const { adminId, conversationId, caseReference, justification, authorizedBy, ipAddress } = params;

  if (!caseReference || caseReference.trim().length < 5) {
    return { success: false, error: "Formal case reference required (minimum 5 characters, e.g. DISPUTE-2026-0042)" };
  }
  if (!justification || justification.trim().length < 20) {
    return { success: false, error: "Substantive legal or trade justification required (minimum 20 characters)" };
  }
  if (!authorizedBy || authorizedBy.trim().length < 3) {
    return { success: false, error: "Authorizing compliance supervisor/authority required" };
  }

  // Verify conversation exists
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
  if (!conv) {
    return { success: false, error: "Target deal room does not exist" };
  }

  const expiresAt = new Date(Date.now() + COMPLIANCE_GRANT_LIFETIME_MS);
  const secret = getSessionSecret();

  // Generate ephemeral random token identifier
  const nonce = crypto.randomBytes(16).toString("hex");
  const payload = `${adminId}.${conversationId}.${expiresAt.getTime()}.${nonce}`;
  const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const grantToken = `${payload}.${hmac}`;
  const grantTokenHash = crypto.createHash("sha256").update(grantToken).digest("hex");

  // Insert durable audit log record in PostgreSQL
  await db.insert(complianceAuditLogs).values({
    adminId,
    conversationId,
    caseReference: caseReference.trim(),
    justification: justification.trim(),
    authorizedBy: authorizedBy.trim(),
    action: "inspection_access",
    ipAddress: ipAddress || null,
    grantTokenHash,
    expiresAt,
  });

  return {
    success: true,
    grantToken,
    expiresAt,
  };
}

/**
 * Strictly verifies a compliance grant token against cryptographic signature,
 * expiry, and durable audit records in the database.
 */
export async function verifyComplianceGrant(
  grantToken: string | null,
  conversationId: number,
  adminId: number
): Promise<boolean> {
  if (!grantToken || typeof grantToken !== "string") {
    return false;
  }

  const parts = grantToken.split(".");
  if (parts.length !== 5) {
    return false;
  }

  const [tAdminIdStr, tConvIdStr, tExpiresAtStr, nonce, hmac] = parts;
  const tAdminId = parseInt(tAdminIdStr, 10);
  const tConvId = parseInt(tConvIdStr, 10);
  const tExpiresAt = parseInt(tExpiresAtStr, 10);

  if (isNaN(tAdminId) || isNaN(tConvId) || isNaN(tExpiresAt)) {
    return false;
  }

  // Must match current request resource and caller identity
  if (tAdminId !== adminId || tConvId !== conversationId) {
    return false;
  }

  // Expiration check
  if (Date.now() > tExpiresAt) {
    return false;
  }

  // Verify HMAC signature
  const secret = getSessionSecret();
  const payload = `${tAdminId}.${tConvId}.${tExpiresAt}.${nonce}`;
  const expectedHmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  const hmacBuf = Buffer.from(hmac, "utf-8");
  const expectedBuf = Buffer.from(expectedHmac, "utf-8");
  if (hmacBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(hmacBuf, expectedBuf)) {
    return false;
  }

  // Durable database record lookup: confirm active audit log entry exists
  const grantTokenHash = crypto.createHash("sha256").update(grantToken).digest("hex");
  const [auditRecord] = await db
    .select()
    .from(complianceAuditLogs)
    .where(
      and(
        eq(complianceAuditLogs.grantTokenHash, grantTokenHash),
        eq(complianceAuditLogs.adminId, adminId),
        eq(complianceAuditLogs.conversationId, conversationId),
        gt(complianceAuditLogs.expiresAt, new Date())
      )
    )
    .limit(1);

  return !!auditRecord;
}
