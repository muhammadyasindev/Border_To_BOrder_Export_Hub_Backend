import { NextResponse } from "next/server";
import fs from "fs";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { conversationParticipants } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getAttachmentRecord, getAttachmentFilePath } from "@/lib/attachments";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const record = getAttachmentRecord(id);

  if (!record) {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  }

  // Strict resource-level authorization: User must be a participant in the conversation
  const [membership] = await db.select().from(conversationParticipants)
    .where(and(
      eq(conversationParticipants.conversationId, record.conversationId),
      eq(conversationParticipants.userId, user.id)
    ))
    .limit(1);

  if (!membership) {
    return NextResponse.json({ error: "Access denied to this private trade document" }, { status: 403 });
  }

  const filePath = getAttachmentFilePath(record.storageName);
  if (!filePath) {
    return NextResponse.json({ error: "Attachment file missing from storage" }, { status: 404 });
  }

  try {
    const fileBuffer = fs.readFileSync(filePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": record.mime || "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(record.filename)}"`,
        "Content-Length": fileBuffer.length.toString(),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to read attachment" }, { status: 500 });
  }
}
