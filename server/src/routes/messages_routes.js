import express from "express";
import Message from "../models/message_model.js";
import { authMiddleware } from "../middleware/auth_middleware.js";
import { asyncHandler } from "../utils/async_handler.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/:roomId", asyncHandler(async (req, res) => {
  const messages = await Message.find({ roomId: req.params.roomId })
    .populate("sender", "fullName email avatarUrl")
    .sort({ createdAt: -1 })
    .limit(50);

  res.json({ messages: messages.reverse() });
}));

router.post("/:roomId", asyncHandler(async (req, res) => {
  const { content = "", messageType = "text", mediaUrl = "" } = req.body;

  if (!content.trim() && !mediaUrl) {
    return res.status(400).json({ error: "Message content or media is required." });
  }

  const message = await Message.create({
    sender: req.user._id,
    roomId: req.params.roomId,
    content: content.trim(),
    messageType,
    mediaUrl,
  });

  req.app.get("io")?.to(req.params.roomId).emit("chat:message", message);
  res.status(201).json({ message });
}));

export default router;
