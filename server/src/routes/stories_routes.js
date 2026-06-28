import express from "express";
import Story from "../models/story_model.js";
import { authMiddleware } from "../middleware/auth_middleware.js";
import { asyncHandler } from "../utils/async_handler.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", asyncHandler(async (_req, res) => {
  const stories = await Story.find({ expiresAt: { $gt: new Date() } })
    .populate("author", "fullName email avatarUrl")
    .sort({ createdAt: -1 });

  res.json({ stories });
}));

router.post("/", asyncHandler(async (req, res) => {
  const { caption = "", mediaUrl, mediaType = "image" } = req.body;

  if (!mediaUrl) {
    return res.status(400).json({ error: "Story media URL is required." });
  }

  const story = await Story.create({
    author: req.user._id,
    caption,
    mediaUrl,
    mediaType,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  res.status(201).json({ story });
}));

export default router;
