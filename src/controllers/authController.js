import User from "../models/User.js";
import EmailVerification from "../models/EmailVerification.js";
import PasswordReset from "../models/PasswordReset.js";
import { hashPassword, verifyPassword, signUserId, generateOtp, hashOtp } from "../utils/crypto.js";
import { sendEmail } from "../services/emailService.js";
import { env as config } from "../config/env.js";

function setSessionCookie(res, userId) {
  const token = signUserId(userId);
  const isSecure = config.NODE_ENV === "production";

  res.cookie("bg_user_id", token, {
    path: "/",
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: config.COOKIE_SAME_SITE,
    secure: isSecure,
  });

  return token;
}

// 1. Send Registration OTP
async function sendRegistrationOtp(req, res, next) {
  try {
    const { email } = req.body;
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "A valid email address is required" });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(409).json({ error: "This email address is already registered. Please sign in." });
    }

    const otp = generateOtp();
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await EmailVerification.create({
      email: cleanEmail,
      otpHash,
      attempts: 0,
      expiresAt,
    });

    const emailResult = await sendEmail({
      to: cleanEmail,
      subject: "BorderGlow Registration Verification Code",
      text: `Your BorderGlow registration verification code is: ${otp}\n\nThis single-use code expires in 15 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <h2 style="color: #0f172a; margin-bottom: 8px;">BorderGlow Email Verification</h2>
          <p style="color: #475569; font-size: 14px;">Enter the following single-use verification code to activate your trade account:</p>
          <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <span style="font-size: 28px; font-weight: bold; letter-spacing: 6px; font-family: monospace; color: #0284c7;">${otp}</span>
          </div>
          <p style="color: #64748b; font-size: 12px;">This code expires in 15 minutes. Never share this code with anyone.</p>
        </div>
      `,
    });

    if (!emailResult.success) {
      return res.status(503).json({
        error: emailResult.error || "Unable to deliver verification code. Please check server email settings.",
      });
    }

    res.json({
      success: true,
      message: `A 6-digit verification code has been dispatched to ${cleanEmail}. Please check your inbox.`,
    });
  } catch (err) {
    next(err);
  }
}

// 2. Complete Registration
async function register(req, res, next) {
  try {
    const {
      email,
      password,
      fullName,
      businessName,
      role,
      country,
      city,
      phone,
      bio,
      otp,
      cnicNumber,
      personAddress,
      businessAddress,
      drivingLicenseNumber,
      plateNumber,
    } = req.body;

    if (!email || !password || !fullName || !role) {
      return res.status(400).json({ error: "Missing required registration fields" });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check existing
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(409).json({ error: "Email is already registered" });
    }

    // Verify OTP if provided
    if (otp) {
      const pendingRecord = await EmailVerification.findOne({
        email: cleanEmail,
        usedAt: null,
        expiresAt: { $gt: new Date() },
      }).sort({ createdAt: -1 });

      if (pendingRecord) {
        const inputHash = hashOtp(otp.trim());
        if (inputHash !== pendingRecord.otpHash) {
          pendingRecord.attempts += 1;
          await pendingRecord.save();
          return res.status(400).json({ error: "Invalid verification code. Please check and try again." });
        }
        pendingRecord.usedAt = new Date();
        await pendingRecord.save();
      }
    }

    const passwordHash = await hashPassword(password);

    const user = await User.create({
      email: cleanEmail,
      passwordHash,
      fullName: fullName.trim(),
      businessName: businessName ? businessName.trim() : null,
      role,
      country: country || "Pakistan",
      city: city || "Karachi",
      phone: phone || null,
      bio: bio || null,
      cnicNumber: cnicNumber || null,
      personAddress: personAddress || null,
      businessAddress: businessAddress || null,
      drivingLicenseNumber: drivingLicenseNumber || null,
      plateNumber: plateNumber || null,
      verificationStatus: "not_submitted",
    });

    const token = setSessionCookie(res, user._id.toString());
    res.status(201).json({ success: true, user, token });
  } catch (err) {
    next(err);
  }
}

// 3. Login
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = setSessionCookie(res, user._id.toString());
    res.json({ success: true, user, token });
  } catch (err) {
    next(err);
  }
}

// 4. Logout
async function logout(req, res) {
  res.clearCookie("bg_user_id", {
    path: "/",
    httpOnly: true,
    sameSite: config.COOKIE_SAME_SITE,
    secure: config.NODE_ENV === "production",
  });
  res.json({ success: true, message: "Logged out successfully" });
}

// 5. Get Current User (/api/auth/me)
async function getMe(req, res) {
  res.json({ user: req.user || null });
}

// 6. Switch Persona (Staging / Dev demo helper)
async function switchPersona(req, res, next) {
  try {
    if (config.NODE_ENV === "production" && !config.ENABLE_DEV_PERSONA_SWITCH) {
      return res.status(403).json({ error: "Persona switching is disabled in production environment." });
    }

    const { userId, role } = req.body;
    const currentUser = req.user;

    if (role === "admin" && (!currentUser || currentUser.role !== "admin")) {
      return res.status(403).json({ error: "Cannot escalate role to administrator" });
    }

    if (role && currentUser && ["exporter", "importer", "driver"].includes(role)) {
      currentUser.role = role;
      await currentUser.save();
      return res.json({ success: true, user: currentUser });
    }

    if (!userId) {
      return res.status(400).json({ error: "userId required" });
    }

    const targetUser = await User.findById(userId).select("-passwordHash");
    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const token = setSessionCookie(res, targetUser._id.toString());
    res.json({ success: true, user: targetUser, token });
  } catch (err) {
    next(err);
  }
}

// 7. Forgot Password
async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "A valid email address is required" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });

    // Anti-enumeration: return success message even if email doesn't exist
    if (!user) {
      return res.json({
        success: true,
        message: "If that email address is registered, a 6-digit recovery code has been dispatched.",
      });
    }

    const otp = generateOtp();
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await PasswordReset.create({
      email: cleanEmail,
      otpHash,
      attempts: 0,
      expiresAt,
    });

    await sendEmail({
      to: cleanEmail,
      subject: "BorderGlow Password Reset Code",
      text: `Your password recovery verification code is: ${otp}\n\nExpires in 15 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <h2 style="color: #0f172a; margin-bottom: 8px;">BorderGlow Password Reset</h2>
          <p style="color: #475569; font-size: 14px;">Enter the following single-use verification code to reset your account password:</p>
          <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <span style="font-size: 28px; font-weight: bold; letter-spacing: 6px; font-family: monospace; color: #dc2626;">${otp}</span>
          </div>
          <p style="color: #64748b; font-size: 12px;">Expires in 15 minutes. If you did not request this, please ignore this email.</p>
        </div>
      `,
    });

    res.json({
      success: true,
      message: "If that email address is registered, a 6-digit recovery code has been dispatched.",
    });
  } catch (err) {
    next(err);
  }
}

// 8. Reset Password
async function resetPassword(req, res, next) {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: "Email, OTP code, and new password are required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters long" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const resetRecord = await PasswordReset.findOne({
      email: cleanEmail,
      usedAt: null,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!resetRecord) {
      return res.status(400).json({ error: "Invalid or expired password reset request. Please request a new code." });
    }

    const inputHash = hashOtp(otp.trim());
    if (inputHash !== resetRecord.otpHash) {
      resetRecord.attempts += 1;
      await resetRecord.save();
      return res.status(400).json({ error: "Invalid verification code. Please check and try again." });
    }

    resetRecord.usedAt = new Date();
    await resetRecord.save();

    const newHash = await hashPassword(newPassword);
    const user = await User.findOneAndUpdate(
      { email: cleanEmail },
      { passwordHash: newHash, sessionsRevokedAt: new Date() },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: "Account not found" });
    }

    const token = setSessionCookie(res, user._id.toString());
    res.json({ success: true, message: "Password updated successfully", user, token });
  } catch (err) {
    next(err);
  }
}

export {
  sendRegistrationOtp,
  register,
  login,
  logout,
  getMe,
  switchPersona,
  forgotPassword,
  resetPassword,
};
