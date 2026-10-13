import User from "../models/User.js";

export async function getUsers(req, res, next) {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { role } = req.query;
    const filter = {};
    if (role) filter.role = role;

    let userList = await User.find(filter).select(
      "fullName email businessName role country city verificationStatus avatarUrl"
    );

    // Redact private email addresses unless requester is admin
    if (currentUser.role !== "admin") {
      userList = userList.map((u) => {
        const obj = u.toJSON();
        delete obj.email;
        return obj;
      });
    }

    res.json({ users: userList });
  } catch (err) {
    next(err);
  }
}
