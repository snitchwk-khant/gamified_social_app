import { getFeatureLocks } from "./admin_configs_service";

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function computeTargetPercentage(profile) {
  if (!profile) {
    return 0;
  }

  if (profile.target_percentage !== undefined && profile.target_percentage !== null) {
    return Math.max(0, Math.min(100, toNumber(profile.target_percentage, 0)));
  }

  const monthlyTarget = toNumber(profile.monthly_target_amount, 0);
  const accumulated = toNumber(profile.monthly_sales_accumulated, 0);

  if (monthlyTarget <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, (accumulated / monthlyTarget) * 100));
}

export function canAccessFeature({ featureKey, locks = {}, profile = null, role = "employee" }) {
  const rule = locks?.[featureKey];

  if (!rule) {
    return { allowed: true, reason: "No feature lock rule found." };
  }

  if (rule.enabled === false) {
    return { allowed: false, reason: "Feature is disabled." };
  }

  const normalizedRole = String(role || "employee").trim().toLowerCase();
  const allowedRoles = Array.isArray(rule.allowedRoles)
    ? rule.allowedRoles.map((item) => String(item).trim().toLowerCase())
    : [];

  if (allowedRoles.length > 0 && !allowedRoles.includes(normalizedRole)) {
    return { allowed: false, reason: "Role is not allowed." };
  }

  const requiredPercentage = toNumber(rule.minTargetPercentage, 0);
  const actualPercentage = computeTargetPercentage(profile);

  if (actualPercentage < requiredPercentage) {
    return {
      allowed: false,
      reason: "Target percentage requirement not met.",
      requiredPercentage,
      actualPercentage,
    };
  }

  return {
    allowed: true,
    reason: "Access granted.",
    requiredPercentage,
    actualPercentage,
  };
}

export async function evaluateFeatureLock({ featureKey, profile = null, role = "employee" }) {
  const locks = await getFeatureLocks();
  const result = canAccessFeature({ featureKey, locks, profile, role });

  return {
    ...result,
    featureKey,
    locks,
  };
}

export default {
  computeTargetPercentage,
  canAccessFeature,
  evaluateFeatureLock,
};
