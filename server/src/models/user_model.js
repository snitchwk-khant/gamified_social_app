import mongoose from "mongoose";
import { ROLES } from "../constants/roles.js";

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true },
    employeeId: { type: String, trim: true, unique: true, sparse: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLES, default: "employee", index: true },
    avatarUrl: { type: String, default: "" },
    department: { type: String, default: "" },
    position: { type: String, default: "" },
    bio: { type: String, default: "Team contributor" },
    points: { type: Number, default: 0 },
    badges: { type: [String], default: [] },
    monthlyTargetAmount: { type: Number, default: 0, min: 0 },
    dailySalesAmount: { type: Number, default: 0, min: 0 },
    monthlySalesAccumulated: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
    refreshTokens: { type: [String], default: [] },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

userSchema.virtual("targetPercentage").get(function getTargetPercentage() {
  if (!this.monthlyTargetAmount) {
    return 0;
  }

  return Math.min(100, Math.round((this.monthlySalesAccumulated / this.monthlyTargetAmount) * 100));
});

userSchema.methods.canUseFeature = function canUseFeature(requiredPercentage = 0) {
  return this.targetPercentage >= requiredPercentage;
};

export default mongoose.model("User", userSchema);
