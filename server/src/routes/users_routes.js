import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/user_model.js";
import { ROLES } from "../constants/roles.js";
import { authMiddleware, requireRole } from "../middleware/auth_middleware.js";
import { asyncHandler } from "../utils/async_handler.js";
import { ok, fail } from "../utils/response.js";
import { serializeUser } from "../utils/user_serializer.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", requireRole("admin", "hr", "accountant"), asyncHandler(async (req, res) => {
  const users = await User.find()
    .select("-passwordHash -refreshTokens")
    .sort({ fullName: 1 });

  return ok(
    res,
    200,
    { users: users.map((user) => serializeUser(user)) },
    "Users fetched"
  );
}));

router.post("/", requireRole("admin"), asyncHandler(async (req, res) => {
  const {
    fullName,
    email,
    password = "Password123!",
    employeeId,
    role = "employee",
    department = "",
    position = "",
    monthlyTargetAmount = 0,
  } = req.body;

  if (!fullName || !email) {
    return fail(res, 400, "VALIDATION_ERROR", "Full name and email are required.");
  }

  if (!ROLES.includes(role)) {
    return fail(res, 400, "VALIDATION_ERROR", "Invalid role.");
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    return fail(res, 409, "CONFLICT", "A user with this email already exists.");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    fullName,
    email: normalizedEmail,
    employeeId,
    role,
    department,
    position,
    monthlyTargetAmount,
    passwordHash,
  });

  return ok(res, 201, { user: serializeUser(user) }, "User created");
}));

router.patch("/:id", requireRole("admin", "hr"), asyncHandler(async (req, res) => {
  const allowedFields = ["fullName", "employeeId", "role", "department", "position", "monthlyTargetAmount", "isActive"];
  const update = {};

  allowedFields.forEach((field) => {
    if (Object.hasOwn(req.body, field)) {
      update[field] = req.body[field];
    }
  });

  if (Object.hasOwn(update, "role") && !ROLES.includes(update.role)) {
    return fail(res, 400, "VALIDATION_ERROR", "Invalid role.");
  }

  const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select("-passwordHash -refreshTokens");

  if (!user) {
    return fail(res, 404, "NOT_FOUND", "User not found.");
  }

  return ok(res, 200, { user: serializeUser(user) }, "User updated");
}));

router.patch("/:id/sales", requireRole("admin", "accountant"), asyncHandler(async (req, res) => {
  const dailySalesAmount = Number(req.body.dailySalesAmount || 0);

  if (dailySalesAmount < 0) {
    return fail(res, 400, "VALIDATION_ERROR", "Daily sales amount must be zero or greater.");
  }

  const user = await User.findById(req.params.id);

  if (!user) {
    return fail(res, 404, "NOT_FOUND", "User not found.");
  }

  user.dailySalesAmount = dailySalesAmount;
  user.monthlySalesAccumulated += dailySalesAmount;
  await user.save();

  return ok(res, 200, { user: serializeUser(user) }, "Sales updated");
}));

export default router;
