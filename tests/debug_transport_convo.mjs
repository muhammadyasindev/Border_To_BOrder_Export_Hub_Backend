import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import crypto from "node:crypto";
import User from "../src/models/User.js";
import TransportOffer from "../src/models/TransportOffer.js";

const DEV_SESSION_SECRET = process.env.SESSION_SECRET || "borderglow_dev_hmac_secret_key_minimum_32_characters_for_security";
function createSignedToken(userId, issuedAt = Date.now(), secret = DEV_SESSION_SECRET) {
  const payload = `${userId}.${issuedAt}`;
  const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${hmac}`;
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to Mongo");

  const importer = await User.findOne({ email: "yasinkalati661@gmail.com" }) || await User.findOne({ role: "importer" });
  console.log("Importer:", importer.email, importer._id);

  const offers = await TransportOffer.find({ status: "active" }).populate("driverId");
  console.log("Total active offers:", offers.length);

  for (const offer of offers) {
    console.log("\n--- Testing Offer:", offer._id, offer.title, "---");
    console.log("Driver object:", offer.driverId ? { id: offer.driverId._id, name: offer.driverId.fullName } : "NO DRIVER POPULATED");

    const token = createSignedToken(importer._id);
    const cookie = `auth_token=${token}`;

    const targetUserId = offer.driverId?._id?.toString() || offer.driverId?.toString() || "";
    const body = {
      title: `Haulage Offer: ${offer.title}`,
      recipientId: targetUserId,
      targetUserId: targetUserId,
      targetUserRole: "driver",
      dealSubjectType: "transport",
      transportOfferId: offer._id.toString(),
      transportRequestId: null,
      productId: null,
      productOfferId: null,
      demandId: null,
      initialMessage: `Hello! I would like to initiate trade negotiations for: "${offer.title}".`,
    };

    console.log("Sending body to http://localhost:3001/api/conversations...");
    const res = await fetch("http://localhost:3001/api/conversations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    console.log("Response status:", res.status);
    const text = await res.text();
    console.log("Response body:", text);
  }

  await mongoose.disconnect();
}

run().catch(console.error);
