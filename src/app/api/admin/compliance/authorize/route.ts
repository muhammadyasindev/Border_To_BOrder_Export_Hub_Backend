import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createComplianceGrant } from "@/lib/compliance";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json(
      { error: "Access restricted: Only authorized compliance officers may initiate deal room inspection grants." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { conversationId, caseReference, justification, authorizedBy } = body;

    if (!conversationId) {
      return NextResponse.json({ error: "Target conversationId is required" }, { status: 400 });
    }

    const forwarded = req.headers.get("x-forwarded-for");
    const ipAddress = forwarded ? forwarded.split(",")[0].trim() : undefined;

    const result = await createComplianceGrant({
      adminId: user.id,
      conversationId: Number(conversationId),
      caseReference,
      justification,
      authorizedBy,
      ipAddress,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "Compliance audit case durably recorded. Temporary inspection token issued.",
      grantToken: result.grantToken,
      expiresAt: result.expiresAt,
      caseReference,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to authorize compliance access" }, { status: 500 });
  }
}
