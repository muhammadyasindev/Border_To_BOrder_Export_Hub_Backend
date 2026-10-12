import assert from "node:assert";
import crypto from "node:crypto";

const BASE_URL = "http://localhost:3000";
const DEV_SESSION_SECRET = process.env.SESSION_SECRET || "borderglow_dev_hmac_secret_key_minimum_32_characters_for_security";

function createSignedToken(userId, issuedAt, secret = DEV_SESSION_SECRET) {
  const payload = `${userId}.${issuedAt}`;
  const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${hmac}`;
}

// Helper to obtain a real authenticated session cookie via login
async function loginAndGetCookie(email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Login failed for ${email}: ${res.statusText}`);
  }
  const rawCookie = res.headers.get("set-cookie");
  if (!rawCookie) {
    throw new Error("No set-cookie header received upon login");
  }
  return rawCookie.split(";")[0];
}

async function runTests() {
  console.log("==================================================================");
  console.log("🚀 BORDERGLOW COMPREHENSIVE SECURITY & PRE-DEPLOYMENT TEST SUITE");
  console.log("==================================================================\n");

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    process.stdout.write(`• ${name}... `);
    try {
      await fn();
      console.log("✅ PASSED");
      passed++;
    } catch (err) {
      console.log("❌ FAILED");
      console.error("  Error:", err.message);
      failed++;
    }
  }

  // Obtain legitimate authenticated session cookies for real corridor personas
  const yasinCookie = await loginAndGetCookie("yasinsasoli186@gmail.com", "BorderGlow2025!");
  const mortezaCookie = await loginAndGetCookie("morteza.transit@borderglow.trade", "BorderGlow2025!");
  const tariqCookie = await loginAndGetCookie("tariq.agri@borderglow.trade", "BorderGlow2025!");
  const adminCookie = await loginAndGetCookie("compliance.admin@borderglow.trade", "BorderGlow2025!");

  // -------------------------------------------------------------------------
  // 1. AUTHENTICATION, REGISTRATION & PASSWORD RECOVERY
  // -------------------------------------------------------------------------
  console.log("--- 1. Authentication, Registration & Password Recovery Security ---");

  await test("Anti-Enumeration: forgot-password returns generic message for unknown email", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "doesnotexist999@borderglow.trade" }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.ok(data.message.includes("If an account exists"));
  });

  await test("Anti-Enumeration: forgot-password returns generic message for registered email", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "yasinsasoli186@gmail.com" }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.ok(data.message.includes("If an account exists"));
  });

  await test("OTP Brute-Force Protection: Atomic attempt increment and lockout after 5 tries", async () => {
    const testOtpEmail = `otp.audit.${Date.now()}@borderglow.trade`;
    // Register isolated test account
    await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testOtpEmail,
        password: "InitialPassword123!",
        fullName: "OTP Audit User",
        role: "exporter",
      }),
    });

    // Generate a fresh reset request for this test persona
    await fetch(`${BASE_URL}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testOtpEmail }),
    });

    // Send 5 invalid attempts and verify countdown and lockout
    let lastStatus = 0;
    let lastError = "";
    for (let i = 0; i < 6; i++) {
      const res = await fetch(`${BASE_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testOtpEmail,
          otp: `00000${i}`,
          newPassword: "NewSecurePassword123!",
        }),
      });
      lastStatus = res.status;
      const data = await res.json();
      lastError = data.error || "";
    }
    // After 5 failed attempts, subsequent attempt must be blocked with 429
    assert.ok(lastStatus === 429 || lastError.includes("locked") || lastError.includes("Too many failed attempts"));
  });

  await test("Login: Valid credentials authenticate successfully and set HttpOnly SameSite cookie", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "yasinsasoli186@gmail.com",
        password: "BorderGlow2025!",
      }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.user.email, "yasinsasoli186@gmail.com");
    const cookieHeader = (res.headers.get("set-cookie") || "").toLowerCase();
    assert.ok(cookieHeader.includes("httponly"));
    assert.ok(cookieHeader.includes("samesite=lax"));
  });

  await test("Login: Invalid password is rejected with 401", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "yasinsasoli186@gmail.com",
        password: "WrongPassword999!",
      }),
    });
    assert.strictEqual(res.status, 401);
  });

  await test("Account Takeover Prevention: Re-registration of existing email is rejected with 409", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "yasinsasoli186@gmail.com",
        password: "MaliciousAttackerPassword123!",
        fullName: "Attacker Account",
        role: "importer",
      }),
    });
    assert.strictEqual(res.status, 409);
    const data = await res.json();
    assert.strictEqual(data.error, "Email is already registered");
  });

  // -------------------------------------------------------------------------
  // 2. SESSION HARDENING, EXPIRY & MULTI-DEVICE REVOCATION
  // -------------------------------------------------------------------------
  console.log("\n--- 2. Session Hardening, Expiry & Multi-Device Revocation ---");

  await test("Session Structure: Token contains 3 parts (userId.issuedAt.hmac)", async () => {
    const tokenVal = yasinCookie.split("=")[1];
    const parts = tokenVal.split(".");
    assert.strictEqual(parts.length, 3, "Token should be userId.issuedAt.hmac");
    assert.ok(!isNaN(parseInt(parts[0], 10)));
    assert.ok(!isNaN(parseInt(parts[1], 10)));
    assert.strictEqual(parts[2].length, 64, "HMAC-SHA256 must be 64 hex characters");
  });

  await test("Tampered Session Cookie Rejection: Forged HMAC cookie returns 401", async () => {
    const res = await fetch(`${BASE_URL}/api/conversations/2`, {
      headers: { Cookie: `bg_user_id=8.${Date.now()}.forged_invalid_hmac_signature_length_64_characters_hex_00000000000000` },
    });
    assert.strictEqual(res.status, 401);
  });

  await test("Tampered Session Token Rejection: Swapped userId returns 401", async () => {
    const parts = yasinCookie.split("=")[1].split(".");
    // Change userId from 8 to 1 keeping original HMAC
    const forgedToken = `1.${parts[1]}.${parts[2]}`;
    const res = await fetch(`${BASE_URL}/api/conversations/2`, {
      headers: { Cookie: `bg_user_id=${forgedToken}` },
    });
    assert.strictEqual(res.status, 401);
  });

  await test("Tampered Session Token Rejection: Swapped timestamp returns 401", async () => {
    const parts = yasinCookie.split("=")[1].split(".");
    // Change timestamp keeping original HMAC
    const forgedToken = `${parts[0]}.${Date.now() - 50000}.${parts[2]}`;
    const res = await fetch(`${BASE_URL}/api/conversations/2`, {
      headers: { Cookie: `bg_user_id=${forgedToken}` },
    });
    assert.strictEqual(res.status, 401);
  });

  await test("Expired Session Rejection: Token issued 8 days ago returns 401", async () => {
    const eightDaysAgo = Date.now() - (8 * 24 * 60 * 60 * 1000);
    const expiredToken = createSignedToken(8, eightDaysAgo);
    const res = await fetch(`${BASE_URL}/api/conversations/2`, {
      headers: { Cookie: `bg_user_id=${expiredToken}` },
    });
    assert.strictEqual(res.status, 401);
  });

  await test("Future-Dated Session Rejection: Token dated 10 minutes in future returns 401", async () => {
    const tenMinutesFuture = Date.now() + (10 * 60 * 1000);
    const futureToken = createSignedToken(8, tenMinutesFuture);
    const res = await fetch(`${BASE_URL}/api/conversations/2`, {
      headers: { Cookie: `bg_user_id=${futureToken}` },
    });
    assert.strictEqual(res.status, 401);
  });

  await test("Malformed Session Token Rejection: Missing parts or non-numeric values return 401", async () => {
    const malformed1 = await fetch(`${BASE_URL}/api/conversations/2`, { headers: { Cookie: "bg_user_id=8.123" } });
    assert.strictEqual(malformed1.status, 401);
    const malformed2 = await fetch(`${BASE_URL}/api/conversations/2`, { headers: { Cookie: "bg_user_id=abc.def.ghi" } });
    assert.strictEqual(malformed2.status, 401);
  });

  await test("Unauthenticated Request Rejection: Request without session returns 401", async () => {
    const res = await fetch(`${BASE_URL}/api/conversations/2`);
    assert.strictEqual(res.status, 401);
  });

  await test("Multi-Device Session Revocation: Logout on Device A immediately revokes Device B", async () => {
    // 1. Establish Session A on Device A
    const devACookie = await loginAndGetCookie("tariq.agri@borderglow.trade", "BorderGlow2025!");
    // Short pause to guarantee distinct timestamp
    await new Promise(r => setTimeout(r, 50));
    // 2. Establish Session B on Device B
    const devBCookie = await loginAndGetCookie("tariq.agri@borderglow.trade", "BorderGlow2025!");

    // Verify Session A works before logout
    const checkA = await fetch(`${BASE_URL}/api/verification`, { headers: { Cookie: devACookie } });
    assert.strictEqual(checkA.status, 200);

    // Verify Session B works before logout
    const checkB = await fetch(`${BASE_URL}/api/verification`, { headers: { Cookie: devBCookie } });
    assert.strictEqual(checkB.status, 200);

    // 3. User logs out from Device A
    const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: "POST",
      headers: { Cookie: devACookie },
    });
    assert.strictEqual(logoutRes.status, 200);

    // 4. Verify Device B's session is now revoked on the server!
    const postLogoutCheckB = await fetch(`${BASE_URL}/api/verification`, { headers: { Cookie: devBCookie } });
    assert.strictEqual(postLogoutCheckB.status, 401, "Device B session must be revoked across browsers/devices");
  });

  await test("Development Persona Switching Guard: POST /api/auth/me is blocked without opt-in flag", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: 1 }),
    });
    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.ok(data.error.includes("disabled"));
  });

  // -------------------------------------------------------------------------
  // 3. ROLE ISOLATION & DEAL ROOM PRIVACY
  // -------------------------------------------------------------------------
  console.log("\n--- 3. Role Isolation & Deal Room Privacy ---");

  // Refresh Yasin cookie after any previous test cycles
  const activeYasinCookie = await loginAndGetCookie("yasinsasoli186@gmail.com", "BorderGlow2025!");

  await test("Deal Room Access: Authorized Importer (Yasin) can read Deal 2", async () => {
    const res = await fetch(`${BASE_URL}/api/conversations/2`, {
      headers: { Cookie: activeYasinCookie },
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.conversation.id, 2);
  });

  await test("Deal Room Access: Authorized Driver (Morteza) can read Deal 2", async () => {
    const res = await fetch(`${BASE_URL}/api/conversations/2`, {
      headers: { Cookie: mortezaCookie },
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.conversation.id, 2);
  });

  await test("Deal Room Privacy: Unrelated Exporter (Tariq) gets 403 Forbidden", async () => {
    const freshTariqCookie = await loginAndGetCookie("tariq.agri@borderglow.trade", "BorderGlow2025!");
    const res = await fetch(`${BASE_URL}/api/conversations/2`, {
      headers: { Cookie: freshTariqCookie },
    });
    assert.strictEqual(res.status, 403);
  });

  await test("Admin Deal Room Default Isolation: Unscoped Admin gets 403 on private deal room", async () => {
    const res = await fetch(`${BASE_URL}/api/conversations/2`, {
      headers: { Cookie: adminCookie },
    });
    assert.strictEqual(res.status, 403);
  });

  await test("Admin Deal Room: Request header alone is rejected with 403", async () => {
    const res = await fetch(`${BASE_URL}/api/conversations/2`, {
      headers: {
        Cookie: adminCookie,
        "x-compliance-audit-reason": "Unauthorized casual attempt without formal case ticket",
      },
    });
    assert.strictEqual(res.status, 403);
  });

  await test("Compliance Workflow: Non-admin cannot issue compliance inspection grant", async () => {
    const res = await fetch(`${BASE_URL}/api/admin/compliance/authorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: activeYasinCookie },
      body: JSON.stringify({
        conversationId: 2,
        caseReference: "CASE-DISPUTE-9999",
        justification: "Unauthorized attempt by non-compliance user",
        authorizedBy: "Unauthorized Actor",
      }),
    });
    assert.strictEqual(res.status, 403);
  });

  let validComplianceGrantToken = "";

  await test("Compliance Workflow: Admin authorizes formal audit case and receives grant token", async () => {
    const res = await fetch(`${BASE_URL}/api/admin/compliance/authorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        conversationId: 2,
        caseReference: "CASE-TAFTAN-DISPUTE-2026",
        justification: "Investigating reported customs paperwork mismatch at Taftan/Mirjaveh border crossing",
        authorizedBy: "Director General of Trade Compliance",
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.grantToken && data.grantToken.length > 20);
    validComplianceGrantToken = data.grantToken;
  });

  await test("Admin Server-Authorized Compliance Access: Admin with valid grant token gets 200", async () => {
    assert.ok(validComplianceGrantToken.length > 0, "No valid grant token available");
    const res = await fetch(`${BASE_URL}/api/conversations/2`, {
      headers: {
        Cookie: adminCookie,
        "x-compliance-grant-token": validComplianceGrantToken,
      },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.conversation.id, 2);
  });

  await test("Compliance Review Access: Non-admin gets 403 on /api/admin/verification", async () => {
    const res = await fetch(`${BASE_URL}/api/admin/verification`, {
      headers: { Cookie: activeYasinCookie },
    });
    assert.strictEqual(res.status, 403);
  });

  await test("Compliance Review Access: Admin gets 200 on /api/admin/verification", async () => {
    const res = await fetch(`${BASE_URL}/api/admin/verification`, {
      headers: { Cookie: adminCookie },
    });
    assert.strictEqual(res.status, 200);
  });

  await test("Privacy: Non-admin users list redacts email addresses", async () => {
    const res = await fetch(`${BASE_URL}/api/users`, {
      headers: { Cookie: activeYasinCookie },
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.ok(data.users.length > 0);
    assert.strictEqual(data.users[0].email, undefined);
  });

  await test("Credential Leakage Prevention: /api/verification does not leak passwordHash", async () => {
    const res = await fetch(`${BASE_URL}/api/verification`, {
      headers: { Cookie: activeYasinCookie },
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.user.passwordHash, undefined);
  });

  // -------------------------------------------------------------------------
  // 4. MESSAGING, ATTACHMENTS & VOICE NOTES SECURITY
  // -------------------------------------------------------------------------
  console.log("\n--- 4. Messaging, Multi-Document Attachments & Voice Notes ---");

  await test("Server Identity Enforcement: Sender identity is strictly derived from session", async () => {
    const res = await fetch(`${BASE_URL}/api/conversations/2`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: activeYasinCookie },
      body: JSON.stringify({
        content: "Verified message from Yasin",
        senderId: 9999, // Attempted spoof
        senderRole: "admin", // Attempted spoof
      }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.message.senderId, 8); // Preserved session user id
    assert.strictEqual(data.message.senderRole, "importer"); // Preserved deal role
  });

  await test("Upload Security: Malformed base64 character encoding is rejected with 400", async () => {
    const res = await fetch(`${BASE_URL}/api/conversations/2`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: activeYasinCookie },
      body: JSON.stringify({
        content: "Malformed base64 test",
        attachments: [{ name: "bad.pdf", dataUrl: "data:application/pdf;base64,!!!invalid_base64_symbols???" }],
      }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes("base64") || data.error.includes("Invalid"));
  });

  await test("Upload Security: Excessive attachment count (> 5 files) is rejected with 400", async () => {
    const dummyPdf = "data:application/pdf;base64," + Buffer.from("%PDF-1.4\n%%EOF").toString("base64");
    const sixAttachments = Array.from({ length: 6 }, (_, i) => ({ name: `doc_${i}.pdf`, dataUrl: dummyPdf }));
    const res = await fetch(`${BASE_URL}/api/conversations/2`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: activeYasinCookie },
      body: JSON.stringify({
        content: "Exceeding attachment limit",
        attachments: sixAttachments,
      }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes("Maximum 5 attachments"));
  });

  await test("Attachment Magic Byte Validation: Disguised executable is rejected with 400", async () => {
    const fakeExecutableData = "data:application/pdf;base64," + Buffer.from("MZThisIsAnExecutableFileScript").toString("base64");
    const res = await fetch(`${BASE_URL}/api/conversations/2`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: activeYasinCookie },
      body: JSON.stringify({
        content: "Attempting malicious file upload",
        attachments: [{ name: "virus.pdf", dataUrl: fakeExecutableData }],
      }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes("Forbidden file type") || data.error.includes("Security Violation"));
  });

  await test("Active PDF Threat Quarantine: Embedded /JavaScript stream is quarantined and rejected with 400", async () => {
    const weaponizedPdfData = "data:application/pdf;base64," + Buffer.from("%PDF-1.4\n1 0 obj\n<< /JavaScript (app.alert('exploit')) >>\nendobj\n%%EOF").toString("base64");
    const res = await fetch(`${BASE_URL}/api/conversations/2`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: activeYasinCookie },
      body: JSON.stringify({
        content: "Attempting weaponized PDF upload",
        attachments: [{ name: "invoice_script.pdf", dataUrl: weaponizedPdfData }],
      }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes("Security Violation") || data.error.includes("prohibited"));
  });

  let uploadedAttachmentId = "";

  await test("Attachment Magic Byte Validation: Genuine PDF is accepted and stored", async () => {
    const realPdfData = "data:application/pdf;base64," + Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF").toString("base64");
    const res = await fetch(`${BASE_URL}/api/conversations/2`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: activeYasinCookie },
      body: JSON.stringify({
        content: "Legitimate trade document attached",
        attachments: [{ name: "Proforma_Invoice.pdf", dataUrl: realPdfData }],
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    const parsed = JSON.parse(data.message.attachments);
    assert.ok(parsed.length > 0);
    uploadedAttachmentId = parsed[0].id;
    assert.ok(uploadedAttachmentId.length > 0);
  });

  await test("Download Access Control: Authorized participant can download attachment", async () => {
    assert.ok(uploadedAttachmentId.length > 0, "No attachment ID available");
    const res = await fetch(`${BASE_URL}/api/attachments/${uploadedAttachmentId}`, {
      headers: { Cookie: activeYasinCookie },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get("content-type"), "application/pdf");
  });

  await test("Download Access Control: Unrelated user gets 403 Forbidden on attachment", async () => {
    const freshTariqCookie = await loginAndGetCookie("tariq.agri@borderglow.trade", "BorderGlow2025!");
    assert.ok(uploadedAttachmentId.length > 0, "No attachment ID available");
    const res = await fetch(`${BASE_URL}/api/attachments/${uploadedAttachmentId}`, {
      headers: { Cookie: freshTariqCookie },
    });
    assert.strictEqual(res.status, 403);
  });

  // -------------------------------------------------------------------------
  // 5. WEBRTC VOICE & VIDEO CALL SIGNALING
  // -------------------------------------------------------------------------
  console.log("\n--- 5. WebRTC Voice & Video Call Signaling ---");

  await test("WebRTC ICE Configuration: Unauthenticated request to /api/webrtc/ice-servers returns 401", async () => {
    const res = await fetch(`${BASE_URL}/api/webrtc/ice-servers`);
    assert.strictEqual(res.status, 401);
  });

  await test("WebRTC ICE Configuration: Authenticated user receives valid iceServers configuration", async () => {
    const res = await fetch(`${BASE_URL}/api/webrtc/ice-servers`, {
      headers: { Cookie: activeYasinCookie },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.iceServers) && data.iceServers.length > 0);
  });

  await test("Call Signaling Authorization: Non-participant gets 403 on call signaling", async () => {
    const freshTariqCookie = await loginAndGetCookie("tariq.agri@borderglow.trade", "BorderGlow2025!");
    const res = await fetch(`${BASE_URL}/api/conversations/2/call`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: freshTariqCookie },
      body: JSON.stringify({ action: "initiate", callType: "voice" }),
    });
    assert.strictEqual(res.status, 403);
  });

  await test("Voice Call Initiation: Authorized participant initiates call room", async () => {
    const res = await fetch(`${BASE_URL}/api/conversations/2/call`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: activeYasinCookie },
      body: JSON.stringify({
        action: "initiate",
        callType: "voice",
        offerSdp: { type: "offer", sdp: "v=0\r\no=yasin 12345 2 IN IP4 127.0.0.1..." },
      }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.call.status, "ringing");
    assert.strictEqual(data.call.callerId, 8);
  });

  await test("Call Signaling Sync: Counterparty driver receives ringing notification", async () => {
    const res = await fetch(`${BASE_URL}/api/conversations/2/call`, {
      headers: { Cookie: mortezaCookie },
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.call.status, "ringing");
    assert.strictEqual(data.call.callerName, "Muhammad Yasin");
  });

  await test("Call Teardown: Call cleanly ends and state is reset", async () => {
    const res = await fetch(`${BASE_URL}/api/conversations/2/call`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: mortezaCookie },
      body: JSON.stringify({ action: "end" }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.status, "ended");
  });

  console.log("\n==================================================================");
  console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error("Test runner error:", e);
  process.exit(1);
});
