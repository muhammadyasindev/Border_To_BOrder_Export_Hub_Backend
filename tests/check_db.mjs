import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");
  const users = await mongoose.connection.db.collection("users").find({}).project({ email: 1, role: 1, fullName: 1 }).toArray();
  console.log("Users in DB count:", users.length);
  console.log("Sample users:", users.slice(0, 10));
  const transports = await mongoose.connection.db.collection("transportoffers").find({}).toArray();
  console.log("Transports in DB:", transports.map(t => ({ id: t._id, title: t.title, driverId: t.driverId, status: t.status })));
  await mongoose.disconnect();
}
check().catch(console.error);
