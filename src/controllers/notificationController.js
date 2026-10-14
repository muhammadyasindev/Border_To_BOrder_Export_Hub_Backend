import Notification from "../models/Notification.js";

export async function getNotifications(req, res, next) {
  try {
    const userId = req.user._id;
    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(30);
    res.json(notifications);
  } catch (err) {
    next(err);
  }
}

export async function markAsRead(req, res, next) {
  try {
    const { id } = req.params;
    const notif = await Notification.findOneAndUpdate(
      { _id: id, userId: req.user._id },
      { isRead: true },
      { new: true }
    );
    if (!notif) return res.status(404).json({ error: "Notification not found" });
    res.json(notif);
  } catch (err) {
    next(err);
  }
}

export async function markAllRead(req, res, next) {
  try {
    await Notification.updateMany({ userId: req.user._id }, { isRead: true });
    res.json({ success: true, message: "All notifications marked as read" });
  } catch (err) {
    next(err);
  }
}

export async function clearAll(req, res, next) {
  try {
    await Notification.deleteMany({ userId: req.user._id });
    res.json({ success: true, message: "All notifications cleared" });
  } catch (err) {
    next(err);
  }
}
