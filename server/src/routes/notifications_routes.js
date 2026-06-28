import express from "express";
import Notification from "../models/notification_model.js";
import { authMiddleware } from "../middleware/auth_middleware.js";
import { asyncHandler } from "../utils/async_handler.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ recipient: req.user._id })
    .populate("actor", "fullName email avatarUrl")
    .sort({ createdAt: -1 })
    .limit(50);

  res.json({ notifications });
}));

router.patch("/:id/read", asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id },
    { readAt: new Date() },
    { new: true }
  );

  if (!notification) {
    return res.status(404).json({ error: "Notification not found." });
  }

  res.json({ notification });
}));

export default router;
