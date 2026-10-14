import Notification from "../models/Notification.js";

/**
 * Creates a server-side notification for a user
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.userId
 * @param {string} params.title
 * @param {string} params.message
 * @param {string} [params.link]
 */
export async function sendNotification({ userId, title, message, link = null }) {
  try {
    if (!userId || !title || !message) return null;
    const notif = await Notification.create({
      userId,
      title: title.trim(),
      message: message.trim(),
      link,
      isRead: false,
    });
    return notif;
  } catch (err) {
    console.warn("Failed to create server notification:", err.message);
    return null;
  }
}
