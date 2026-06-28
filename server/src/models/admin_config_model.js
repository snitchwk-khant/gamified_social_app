import mongoose from "mongoose";

const featureRuleSchema = new mongoose.Schema(
  {
    feature: {
      type: String,
      enum: ["chat", "stories", "stickers", "post_images", "leaderboard"],
      required: true,
    },
    unlockPercentage: { type: Number, default: 0, min: 0, max: 100 },
    enabled: { type: Boolean, default: true },
  },
  { _id: false }
);

const adminConfigSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    featureRules: {
      type: [featureRuleSchema],
      default: [
        { feature: "chat", unlockPercentage: 50, enabled: true },
        { feature: "stories", unlockPercentage: 100, enabled: true },
        { feature: "stickers", unlockPercentage: 100, enabled: true },
        { feature: "post_images", unlockPercentage: 0, enabled: true },
        { feature: "leaderboard", unlockPercentage: 0, enabled: true },
      ],
    },
    monthlyResetDay: { type: Number, default: 1, min: 1, max: 28 },
    timezone: { type: String, default: "Asia/Yangon" },
  },
  { timestamps: true }
);

export default mongoose.model("AdminConfig", adminConfigSchema);
