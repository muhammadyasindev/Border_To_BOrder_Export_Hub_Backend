import VerificationDocument from "../models/VerificationDocument.js";
import User from "../models/User.js";

export async function getVerification(req, res, next) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const freshUser = await User.findById(user._id).select("-passwordHash");
    const docs = await VerificationDocument.find({ userId: user._id }).sort({ submittedAt: -1 });

    return res.json({
      user: freshUser,
      verificationStatus: freshUser?.verificationStatus || user.verificationStatus,
      verificationNotes: freshUser?.verificationNotes || user.verificationNotes,
      cnicNumber: freshUser?.cnicNumber,
      personAddress: freshUser?.personAddress,
      businessAddress: freshUser?.businessAddress,
      avatarUrl: freshUser?.avatarUrl,
      documents: docs,
    });
  } catch (err) {
    next(err);
  }
}

export async function submitVerification(req, res, next) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

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
    } = req.body;

    const userUpdates = { updatedAt: new Date() };
    if (cnicNumber) userUpdates.cnicNumber = cnicNumber;
    if (personAddress) userUpdates.personAddress = personAddress;
    if (businessAddress) userUpdates.businessAddress = businessAddress;
    if (avatarUrl) userUpdates.avatarUrl = avatarUrl;
    if (businessName) userUpdates.businessName = businessName;

    if (user.verificationStatus !== "verified") {
      userUpdates.verificationStatus = "pending_review";
    }

    await User.findByIdAndUpdate(user._id, userUpdates);

    let docRecord = null;
    if (documentType && fileName) {
      docRecord = await VerificationDocument.create({
        userId: user._id,
        documentType,
        documentNumber: documentNumber || cnicNumber || "VERIF-DOC-SYS",
        fileName,
        fileUrl: avatarUrl || `/uploads/verif_${Date.now()}_${encodeURIComponent(fileName)}`,
        fileSize: fileSize || "1.4 MB",
        status: "pending_review",
      });
    }

    const updatedUser = await User.findById(user._id).select("-passwordHash");

    return res.json({
      success: true,
      message: "Identity and verification details submitted for review",
      user: updatedUser,
      document: docRecord,
    });
  } catch (err) {
    next(err);
  }
}
