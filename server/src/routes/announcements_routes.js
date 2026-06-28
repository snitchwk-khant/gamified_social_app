import express from "express";
import Announcement from "../models/announcement_model.js";
import { authMiddleware, requireRole } from "../middleware/auth_middleware.js";
import { asyncHandler } from "../utils/async_handler.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", asyncHandler(async (_req, res) => {
  const announcements = await Announcement.find({
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  })
    .populate("author", "fullName email avatarUrl")
    .sort({ isPinned: -1, createdAt: -1 });

  res.json({ announcements });
}));

router.post("/", requireRole("admin", "hr"), asyncHandler(async (req, res) => {
  const { title, body, imageUrl = "", priority = "important", isPinned = true, expiresAt = null } = req.body;

  if (!title || !body) {
    return res.status(400).json({ error: "Announcement title and body are required." });
  }

  const announcement = await Announcement.create({
    author: req.user._id,
    title,
    body,
    imageUrl,
    priority,
    isPinned,
    expiresAt,
  });

  res.status(201).json({ announcement });
}));

export default router;
