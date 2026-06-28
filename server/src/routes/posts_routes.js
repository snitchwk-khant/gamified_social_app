import express from "express";
import Post from "../models/post_model.js";
import { authMiddleware } from "../middleware/auth_middleware.js";
import { asyncHandler } from "../utils/async_handler.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", asyncHandler(async (_req, res) => {
  const posts = await Post.find()
    .populate("author", "fullName email avatarUrl")
    .sort({ isPinned: -1, createdAt: -1 })
    .limit(50);

  res.json({ posts });
}));

router.post("/", asyncHandler(async (req, res) => {
  const { content = "", imageUrl = "", isAnonymous = false } = req.body;

  if (!content.trim() && !imageUrl) {
    return res.status(400).json({ error: "Post content or image is required." });
  }

  const post = await Post.create({
    author: req.user._id,
    content: content.trim(),
    imageUrl,
    isAnonymous,
  });

  res.status(201).json({ post });
}));

router.post("/:id/like", asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    return res.status(404).json({ error: "Post not found." });
  }

  const alreadyLiked = post.likes.some((id) => id.toString() === req.user._id.toString());
  post.likes = alreadyLiked
    ? post.likes.filter((id) => id.toString() !== req.user._id.toString())
    : [...post.likes, req.user._id];
  await post.save();

  res.json({ post, liked: !alreadyLiked });
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    return res.status(404).json({ error: "Post not found." });
  }

  const canDelete = req.user.role === "admin" || post.author.toString() === req.user._id.toString();

  if (!canDelete) {
    return res.status(403).json({ error: "You cannot remove this post." });
  }

  await post.deleteOne();
  res.json({ ok: true });
}));

export default router;
