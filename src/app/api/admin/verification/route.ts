import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { users, verificationDocuments } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    // If not admin, return 403
    return NextResponse.json({ error: "Restricted to authorized compliance reviewers" }, { status: 403 });
  }

  // Get all pending docs with user info
  const docs = await db.select({
    id: verificationDocuments.id,
    userId: verificationDocuments.userId,
    documentType: verificationDocuments.documentType,
    documentNumber: verificationDocuments.documentNumber,
    fileName: verificationDocuments.fileName,
    fileUrl: verificationDocuments.fileUrl,
    fileSize: verificationDocuments.fileSize,
    status: verificationDocuments.status,
    reviewerNotes: verificationDocuments.reviewerNotes,
    submittedAt: verificationDocuments.submittedAt,
    userFullName: users.fullName,
    userBusinessName: users.businessName,
    userRole: users.role,
    userCountry: users.country,
    userVerificationStatus: users.verificationStatus,
  })
  .from(verificationDocuments)
  .leftJoin(users, eq(verificationDocuments.userId, users.id))
  .orderBy(desc(verificationDocuments.submittedAt));

  return NextResponse.json({ documents: docs });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Restricted to authorized compliance reviewers" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { docId, targetUserId, action, notes } = body; // action: 'approve' | 'reject' | 'changes_required'

    if (!docId || !targetUserId || !action) {
      return NextResponse.json({ error: "Missing required review fields" }, { status: 400 });
    }

    const docStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : "changes_required";
    const userStatus = action === "approve" ? "verified" : action === "reject" ? "rejected" : "changes_required";

    await db.update(verificationDocuments).set({
      status: docStatus,
      reviewerNotes: notes || `Reviewed by Compliance Officer ${user.fullName}`,
      reviewedAt: new Date(),
    }).where(eq(verificationDocuments.id, Number(docId)));

    await db.update(users).set({
      verificationStatus: userStatus,
      verificationNotes: notes || (action === "approve" ? "Approved by compliance" : "Documentation needs revision"),
      verifiedAt: action === "approve" ? new Date() : null,
      updatedAt: new Date(),
    }).where(eq(users.id, Number(targetUserId)));

    return NextResponse.json({ success: true, message: `Status updated to ${userStatus}` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
