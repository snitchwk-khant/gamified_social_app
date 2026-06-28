import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user_model.js";
import config from "../config/index.js";
import { asyncHandler } from "../utils/async_handler.js";
import { authMiddleware } from "../middleware/auth_middleware.js";
import { ok, fail } from "../utils/response.js";
import { serializeUser } from "../utils/user_serializer.js";

const router = express.Router();

function buildAuthPayload(user) {
  const accessToken = jwt.sign({ id: user._id, role: user.role }, config.jwtSecret, {
    expiresIn: "15m",
  });
  const refreshToken = jwt.sign({ id: user._id, role: user.role }, config.jwtRefreshSecret, {
    expiresIn: "7d",
  });

  return { accessToken, refreshToken };
}

router.post("/login", asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return fail(res, 400, "VALIDATION_ERROR", "Email and password are required");
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    return fail(res, 401, "INVALID_CREDENTIALS", "Invalid credentials");
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    return fail(res, 401, "INVALID_CREDENTIALS", "Invalid credentials");
  }

  const { accessToken, refreshToken } = buildAuthPayload(user);
  user.refreshTokens = [...user.refreshTokens, refreshToken].slice(-5);
  await user.save();

  return ok(
    res,
    200,
    { accessToken, refreshToken, user: serializeUser(user) },
    "Login successful"
  );
}));

router.post("/refresh", asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return fail(res, 400, "VALIDATION_ERROR", "Refresh token is required");
  }

  let payload;
  try {
    payload = jwt.verify(refreshToken, config.jwtRefreshSecret);
  } catch {
    return fail(res, 401, "INVALID_REFRESH_TOKEN", "Invalid refresh token");
  }

  const user = await User.findById(payload.id);

  if (!user || !user.refreshTokens.includes(refreshToken)) {
    return fail(res, 401, "INVALID_REFRESH_TOKEN", "Invalid refresh token");
  }

  const tokens = buildAuthPayload(user);
  user.refreshTokens = user.refreshTokens.filter((token) => token !== refreshToken);
  user.refreshTokens.push(tokens.refreshToken);
  await user.save();

  return ok(
    res,
    200,
    { ...tokens, user: serializeUser(user) },
    "Token refreshed"
  );
}));

router.post("/logout", authMiddleware, asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    await User.findByIdAndUpdate(req.user._id, { $pull: { refreshTokens: refreshToken } });
  }

  return ok(res, 200, { loggedOut: true }, "Logout successful");
}));

router.get("/profile", authMiddleware, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    return fail(res, 404, "NOT_FOUND", "Profile not found");
  }

  return ok(res, 200, { user: serializeUser(user) }, "Profile fetched");
}));

export default router;
