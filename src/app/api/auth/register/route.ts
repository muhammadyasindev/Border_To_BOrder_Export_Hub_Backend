import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, vehicles } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { signUserId, getSessionCookieOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      email,
      password,
      fullName,
      businessName,
      role,
      country,
      city,
      phone,
      cnicNumber,
      personAddress,
      businessAddress,
      drivingLicenseNumber,
      licenseExpiryDate,
      plateNumber,
      vehicleType,
    } = body;

    if (!email || !password || !fullName || !role) {
      return NextResponse.json({ error: "Missing required registration fields" }, { status: 400 });
    }

    if (!["exporter", "importer", "driver"].includes(role)) {
      return NextResponse.json({ error: "Invalid role specified" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters long" }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if user already exists with this email - STRICT NO OVERWRITE
    const [existingUser] = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);
    if (existingUser) {
      return NextResponse.json({ error: "Email is already registered" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [newUser] = await db.insert(users).values({
      email: cleanEmail,
      passwordHash,
      fullName,
      businessName: role === "driver" ? "Independent Transporter" : (businessName || null),
      role,
      country: country || "Pakistan",
      city: city || "Quetta",
      phone: phone || null,
      cnicNumber: cnicNumber || null,
      personAddress: personAddress || null,
      businessAddress: businessAddress || null,
      drivingLicenseNumber: drivingLicenseNumber || null,
      licenseExpiryDate: licenseExpiryDate || null,
      plateNumber: plateNumber || null,
      verificationStatus: "not_submitted",
    }).returning();

    // If driver registered with vehicle plate, create linked vehicle entry
    if (role === "driver" && plateNumber) {
      try {
        await db.insert(vehicles).values({
          driverId: newUser.id,
          vehicleType: vehicleType || "General Cargo Carrier",
          makeModel: "Commercial Fleet Vehicle",
          registrationCountry: country || "Pakistan",
          plateNumberMasked: plateNumber.length > 4 ? `PK-***-${plateNumber.slice(-4)}` : plateNumber,
          plateNumberFull: plateNumber,
          capacityTons: "25",
          supportedCargo: "General Cargo & Perishables",
          supportedCorridors: "Taftan-Mirjaveh, Chaman-Spin Boldak, Gwadar-Rimdan",
          isAvailable: true,
          verificationStatus: "pending_review",
        });
      } catch (vehErr) {
        console.warn("Auto-vehicle creation notice:", vehErr);
      }
    }

    const response = NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.fullName,
        role: newUser.role,
        verificationStatus: newUser.verificationStatus,
      },
    });

    const token = signUserId(newUser.id);
    response.cookies.set("bg_user_id", token, getSessionCookieOptions());

    return response;
  } catch (error: any) {
    if (error.code === "23505" || error.message?.includes("unique")) {
      return NextResponse.json({ error: "Email is already registered" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message || "Registration failed" }, { status: 500 });
  }
}
