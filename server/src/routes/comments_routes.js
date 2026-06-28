import express from "express";
import Comment from "../models/comment_model.js";
import Post from "../models/post_model.js";
import { authMiddleware } from "../middleware/auth_middleware.js";
import { asyncHandler } from "../utils/async_handler.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/post/:postId", asyncHandler(async (req, res) => {
  const comments = await Comment.find({ post: req.params.postId })
    .populate("author", "fullName email avatarUrl")
    .sort({ createdAt: 1 });

  res.json({ comments });
}));

router.post("/post/:postId", asyncHandler(async (req, res) => {
  const { content, isAnonymous = false } = req.body;

  if (!content?.trim()) {
    return res.status(400).json({ error: "Comment content is required." });
  }

  const post = await Post.findById(req.params.postId);

  if (!post) {
    return res.status(404).json({ error: "Post not found." });
  }

  const comment = await Comment.create({
    post: post._id,
    author: req.user._id,
    content: content.trim(),
    isAnonymous,
  });

  post.commentsCount += 1;
  await post.save();

  res.status(201).json({ comment });
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const comment = await Comment.findById(req.params.id);

  if (!comment) {
    return res.status(404).json({ error: "Comment not found." });
  }

  const canDelete = req.user.role === "admin" || comment.author.toString() === req.user._id.toString();

  if (!canDelete) {
    return res.status(403).json({ error: "You cannot remove this comment." });
  }

  await comment.deleteOne();
  await Post.findByIdAndUpdate(comment.post, { $inc: { commentsCount: -1 } });
  res.json({ ok: true });
}));

export default router;
