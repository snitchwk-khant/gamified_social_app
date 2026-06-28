import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    roomId: { type: String, default: "company", index: true },
    content: { type: String, default: "", trim: true },
    messageType: { type: String, enum: ["text", "image", "sticker"], default: "text" },
    mediaUrl: { type: String, default: "" },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

messageSchema.index({ roomId: 1, createdAt: -1 });

export default mongoose.model("Message", messageSchema);
