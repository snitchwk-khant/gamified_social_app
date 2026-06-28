import mongoose from "mongoose";

const storySchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    caption: { type: String, default: "", trim: true },
    mediaUrl: { type: String, required: true },
    mediaType: { type: String, enum: ["image", "video"], default: "image" },
    viewers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true }
);

export default mongoose.model("Story", storySchema);
