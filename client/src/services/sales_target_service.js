import { supabase } from "../lib/supabase";
import { calculateAchievement } from "./leaderboard_service";

const SALES_TARGET_FIELDS = [
  "id",
  "user_id",
  "month",
  "year",
  "target_sales",
  "current_sales",
  "created_by",
  "created_at",
  "updated_at",
].join(",");

const SALES_TARGET_WITH_PROFILE_FIELDS = `${SALES_TARGET_FIELDS},profile:profiles!sales_targets_user_id_fkey(id,full_name,email,avatar_url,role)`;
const EMPLOYEE_FIELDS = "id,full_name,email,avatar_url";

function normalizeInteger(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeSalesValue(value) {
  return Math.max(0, normalizeInteger(value));
}

function validatePeriod(month, year) {
  const normalizedMonth = normalizeInteger(month);
  const normalizedYear = normalizeInteger(year);

  if (normalizedMonth < 1 || normalizedMonth > 12) {
    throw new Error("Month must be between 1 and 12.");
  }

  if (!normalizedYear) {
    throw new Error("Year is required.");
  }

  return {
    month: normalizedMonth,
    year: normalizedYear,
  };
}

export { calculateAchievement };

export async function getSalesTargets({ month = null, year = null } = {}) {
  let query = supabase
    .from("sales_targets")
    .select(SALES_TARGET_WITH_PROFILE_FIELDS)
    .order("year", { ascending: false })
    .order("month", { ascending: false });

  if (month) {
    query = query.eq("month", normalizeInteger(month));
  }

  if (year) {
    query = query.eq("year", normalizeInteger(year));
  }

  const response = await query;
  const { data, error } = response;

  if (error) {
    throw new Error(error.message || "Unable to load sales targets.");
  }

  const rows = data || [];

  return rows;
}

export async function getUserSalesTarget(userId, month, year) {
  if (!userId) {
    throw new Error("User id is required.");
  }

  const period = validatePeriod(month, year);

  const { data, error } = await supabase
    .from("sales_targets")
    .select(SALES_TARGET_WITH_PROFILE_FIELDS)
    .eq("user_id", userId)
    .eq("month", period.month)
    .eq("year", period.year)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Unable to load sales target.");
  }

  return data;
}

export async function getSalesTargetEmployees() {
  const { data, error } = await supabase
    .from("profiles")
    .select(EMPLOYEE_FIELDS)
    .eq("role", "employee")
    .order("full_name", { ascending: true });

  if (error) {
    throw new Error(error.message || "Unable to load employees.");
  }

  return data || [];
}

export async function assignSalesTarget({ userId, user_id, month, year, targetSales, target_sales }) {
  const targetUserId = userId || user_id;

  if (!targetUserId) {
    throw new Error("Employee is required.");
  }

  const existing = await getUserSalesTarget(targetUserId, month, year);

  if (existing?.id) {
    throw new Error("A sales target already exists for this employee and month.");
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    throw new Error(authError?.message || "You must be logged in to assign sales targets.");
  }

  const period = validatePeriod(month, year);

  const { data, error } = await supabase
    .from("sales_targets")
    .insert({
      user_id: targetUserId,
      month: period.month,
      year: period.year,
      target_sales: normalizeSalesValue(targetSales ?? target_sales),
      current_sales: 0,
      created_by: user.id,
    })
    .select(SALES_TARGET_WITH_PROFILE_FIELDS)
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("A sales target already exists for this employee and month.");
    }

    throw new Error(error.message || "Unable to assign sales target.");
  }

  return data;
}

export async function upsertSalesTarget({ userId, user_id, month, year, targetSales, target_sales, currentSales, current_sales }) {
  const targetUserId = userId || user_id;

  if (!targetUserId) {
    throw new Error("User id is required.");
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    throw new Error(authError?.message || "You must be logged in to manage sales targets.");
  }

  const period = validatePeriod(month, year);
  const patch = {
    target_sales: normalizeSalesValue(targetSales ?? target_sales),
    current_sales: normalizeSalesValue(currentSales ?? current_sales),
  };

  const existing = await getUserSalesTarget(targetUserId, period.month, period.year);

  if (existing?.id) {
    const { data, error } = await supabase
      .from("sales_targets")
      .update(patch)
      .eq("id", existing.id)
      .select(SALES_TARGET_WITH_PROFILE_FIELDS)
      .single();

    if (error) {
      throw new Error(error.message || "Unable to update sales target.");
    }

    return data;
  }

  const { data, error } = await supabase
    .from("sales_targets")
    .insert({
      user_id: targetUserId,
      month: period.month,
      year: period.year,
      ...patch,
      created_by: user.id,
    })
    .select(SALES_TARGET_WITH_PROFILE_FIELDS)
    .single();

  if (error) {
    throw new Error(error.message || "Unable to create sales target.");
  }

  return data;
}

export function subscribeToSalesTargets(onChange) {
  const channel = supabase
    .channel("sales-targets-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "sales_targets" },
      onChange
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export default {
  getSalesTargets,
  getUserSalesTarget,
  getSalesTargetEmployees,
  assignSalesTarget,
  upsertSalesTarget,
  subscribeToSalesTargets,
  calculateAchievement,
};
