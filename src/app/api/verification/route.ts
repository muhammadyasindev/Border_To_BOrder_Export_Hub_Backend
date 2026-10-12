import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { verificationDocuments, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch fresh user data with cnic & addresses
  const [freshUser] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  if (freshUser) {
    delete (freshUser as any).passwordHash;
  }

  // Sensitive document list: only owner or admin can view
  const docs = await db.select().from(verificationDocuments)
    .where(eq(verificationDocuments.userId, user.id))
    .orderBy(desc(verificationDocuments.submittedAt));

  return NextResponse.json({
    user: freshUser,
    verificationStatus: freshUser?.verificationStatus || user.verificationStatus,
    verificationNotes: freshUser?.verificationNotes || user.verificationNotes,
    cnicNumber: freshUser?.cnicNumber,
    personAddress: freshUser?.personAddress,
    businessAddress: freshUser?.businessAddress,
    avatarUrl: freshUser?.avatarUrl,
    documents: docs,
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      documentType,
      documentNumber,
      fileName,
      fileSize,
      cnicNumber,
      personAddress,
      businessAddress,
      avatarUrl,
      businessName,
    } = body;

    // 1. Update user identity and address details if provided
    const userUpdates: any = {
      updatedAt: new Date(),
    };
    if (cnicNumber) userUpdates.cnicNumber = cnicNumber;
    if (personAddress) userUpdates.personAddress = personAddress;
    if (businessAddress) userUpdates.businessAddress = businessAddress;
    if (avatarUrl) userUpdates.avatarUrl = avatarUrl;
    if (businessName) userUpdates.businessName = businessName;

    if (user.verificationStatus !== "verified") {
      userUpdates.verificationStatus = "pending_review";
    }

    await db.update(users)
      .set(userUpdates)
      .where(eq(users.id, user.id));

    // 2. Insert document record if uploaded
    let docRecord = null;
    if (documentType && fileName) {
      const [doc] = await db.insert(verificationDocuments).values({
        userId: user.id,
        documentType,
        documentNumber: documentNumber || cnicNumber || "VERIF-DOC-SYS",
        fileName,
        fileUrl: avatarUrl || `/uploads/verif_${Date.now()}_${encodeURIComponent(fileName)}`,
        fileSize: fileSize || "1.4 MB",
        status: "pending_review",
      }).returning();
      docRecord = doc;
    }

    const [updatedUser] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    if (updatedUser) {
      delete (updatedUser as any).passwordHash;
    }

    return NextResponse.json({
      success: true,
      message: "Identity and verification details submitted for review",
      user: updatedUser,
      document: docRecord,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
