import express from "express";
import AdminConfig from "../models/admin_config_model.js";
import User from "../models/user_model.js";
import Post from "../models/post_model.js";
import Comment from "../models/comment_model.js";
import { authMiddleware, requireRole } from "../middleware/auth_middleware.js";
import { asyncHandler } from "../utils/async_handler.js";

const router = express.Router();

router.use(authMiddleware, requireRole("admin"));

router.get("/summary", asyncHandler(async (_req, res) => {
  const [totalUsers, totalPosts, totalComments] = await Promise.all([
    User.countDocuments(),
    Post.countDocuments(),
    Comment.countDocuments(),
  ]);

  res.json({ totalUsers, totalPosts, totalComments });
}));

router.get("/config", asyncHandler(async (_req, res) => {
  const config = await AdminConfig.findOneAndUpdate(
    { key: "default" },
    { $setOnInsert: { key: "default" } },
    { new: true, upsert: true }
  );

  res.json({ config });
}));

router.patch("/config", asyncHandler(async (req, res) => {
  const config = await AdminConfig.findOneAndUpdate(
    { key: "default" },
    { $set: req.body },
    { new: true, upsert: true, runValidators: true }
  );

  res.json({ config });
}));

export default router;
