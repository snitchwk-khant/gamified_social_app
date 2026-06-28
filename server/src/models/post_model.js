import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    content: { type: String, default: "", trim: true },
    imageUrl: { type: String, default: "" },
    isAnonymous: { type: Boolean, default: false },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    commentsCount: { type: Number, default: 0, min: 0 },
    isPinned: { type: Boolean, default: false },
    visibility: { type: String, enum: ["company", "department"], default: "company" },
  },
  { timestamps: true }
);

postSchema.index({ createdAt: -1 });

export default mongoose.model("Post", postSchema);
