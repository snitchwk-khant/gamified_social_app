import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/user_model.js";

export async function connectDb(uri) {
  if (!uri) {
    throw new Error("Missing MongoDB connection string.");
  }

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 2500,
  });
  return mongoose.connection;
}

export async function ensureDefaultUser() {
  const existingAdmin = await User.findOne({ email: "admin@company.com" });
  if (existingAdmin) {
    return;
  }

  const passwordHash = await bcrypt.hash("Password123!", 10);
  const defaultUser = new User({
    fullName: "Core Admin",
    email: "admin@company.com",
    passwordHash,
    role: "admin",
    employeeId: "ADMIN001",
    department: "Operations",
    position: "System Administrator",
    bio: "Internal community leader",
    points: 1500,
    badges: ["Champion", "Mentor"],
    monthlyTargetAmount: 1000000,
    monthlySalesAccumulated: 1000000,
  });

  await defaultUser.save();
  console.log("Created default user: admin@company.com / Password123!");
}
