import mongoose from "mongoose";

const announcementSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    imageUrl: { type: String, default: "" },
    priority: { type: String, enum: ["normal", "important", "urgent"], default: "important" },
    isPinned: { type: Boolean, default: true },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

announcementSchema.index({ isPinned: -1, createdAt: -1 });

export default mongoose.model("Announcement", announcementSchema);
