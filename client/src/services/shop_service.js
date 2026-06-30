import { supabase } from "../lib/supabase";
import { buildPerformanceRanking, calculateAchievement } from "./ranking_service";

const SHOP_FIELDS = [
  "id",
  "code",
  "name",
  "location",
  "is_active",
  "created_at",
  "updated_at",
].join(",");

const SHOP_TARGET_FIELDS = [
  "id",
  "shop_id",
  "year",
  "month",
  "target_sales",
  "current_sales",
  "achievement_percent",
  "updated_by",
  "created_at",
  "updated_at",
  `shop:shops!shop_sales_targets_shop_id_fkey(${SHOP_FIELDS})`,
].join(",");

const SHOP_CHAMPION_FIELDS = [
  "id",
  "month",
  "shop_id",
  "total_points",
  "rank",
  "created_at",
  "updated_at",
  `shop:shops!shop_monthly_champions_shop_id_fkey(${SHOP_FIELDS})`,
].join(",");

function normalizeNumber(value) {
  return Math.max(0, Number(value) || 0);
}

function normalizeInteger(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
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

async function getCurrentUserId() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.id) {
    throw new Error(error?.message || "You must be logged in.");
  }

  return user.id;
}

export async function getShops({ activeOnly = false } = {}) {
  let query = supabase
    .from("shops")
    .select(SHOP_FIELDS)
    .order("name", { ascending: true });

  if (activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || "Unable to load shops.");
  }

  return data || [];
}

export async function createShop(payload = {}) {
  const insertPayload = {
    code: payload.code?.trim() || null,
    name: payload.name?.trim() || "",
    location: payload.location?.trim() || null,
    is_active: payload.is_active !== false,
  };

  if (!insertPayload.name) {
    throw new Error("Shop name is required.");
  }

  const { data, error } = await supabase
    .from("shops")
    .insert(insertPayload)
    .select(SHOP_FIELDS)
    .single();

  if (error) {
    throw new Error(error.message || "Unable to create shop.");
  }

  return data;
}

export async function updateShop(shopId, patch = {}) {
  if (!shopId) {
    throw new Error("Shop id is required.");
  }

  const updatePayload = {};

  if (Object.hasOwn(patch, "code")) updatePayload.code = patch.code?.trim() || null;
  if (Object.hasOwn(patch, "name")) updatePayload.name = patch.name?.trim() || "";
  if (Object.hasOwn(patch, "location")) updatePayload.location = patch.location?.trim() || null;
  if (Object.hasOwn(patch, "is_active")) updatePayload.is_active = Boolean(patch.is_active);

  if (Object.hasOwn(updatePayload, "name") && !updatePayload.name) {
    throw new Error("Shop name is required.");
  }

  const { data, error } = await supabase
    .from("shops")
    .update(updatePayload)
    .eq("id", shopId)
    .select(SHOP_FIELDS)
    .single();

  if (error) {
    throw new Error(error.message || "Unable to update shop.");
  }

  return data;
}

export async function deleteShop(shopId) {
  if (!shopId) {
    throw new Error("Shop id is required.");
  }

  const { data, error } = await supabase.rpc("delete_shop_permanently", {
    target_shop_id: shopId,
  });

  if (error) {
    throw new Error(error.message || "Unable to delete shop.");
  }

  return data;
}

export async function getShopById(shopId) {
  if (!shopId) {
    throw new Error("Shop id is required.");
  }

  const { data, error } = await supabase
    .from("shops")
    .select(SHOP_FIELDS)
    .eq("id", shopId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Unable to load shop.");
  }

  return data;
}

export async function getShopEmployees(shopId) {
  if (!shopId) {
    return [];
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,email,avatar_url,role,shop_id")
    .eq("shop_id", shopId)
    .eq("role", "employee")
    .order("full_name", { ascending: true });

  if (error) {
    throw new Error(error.message || "Unable to load shop employees.");
  }

  return (data || []).map((employee) => ({
    ...employee,
    current_shop_id: employee.shop_id,
  }));
}

export async function getShopAssignmentEmployees() {
  const [{ data: employeeRows, error: employeeError }, { data: shopRows, error: shopError }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id,full_name,email,avatar_url,role,shop_id")
        .eq("role", "employee")
        .order("full_name", { ascending: true }),
      supabase
        .from("shops")
        .select(SHOP_FIELDS),
    ]);

  if (employeeError) {
    throw new Error(employeeError.message || "Unable to load employees.");
  }

  if (shopError) {
    throw new Error(shopError.message || "Unable to load shops.");
  }

  const shopsById = new Map((shopRows || []).map((shop) => [shop.id, shop]));

  return (employeeRows || []).map((employee) => {
    return {
      ...employee,
      current_shop_id: employee.shop_id || null,
      current_shop: employee.shop_id ? shopsById.get(employee.shop_id) || null : null,
    };
  });
}

export async function getEmployeeActiveShopAssignment(employeeId) {
  if (!employeeId) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,shop_id")
    .eq("id", employeeId)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message || "Unable to load employee shop.");
  }

  if (!profile?.shop_id) {
    return null;
  }

  const shop = await getShopById(profile.shop_id);

  return {
    employee_id: profile.id,
    shop_id: profile.shop_id,
    shop,
  };
}

export function getShopEmployeeCounts(employees = []) {
  return employees.reduce((counts, employee) => {
    const shopId = employee?.current_shop_id || employee?.shop_id;

    if (!shopId) {
      return counts;
    }

    counts[shopId] = (counts[shopId] || 0) + 1;
    return counts;
  }, {});
}

export async function updateShopEmployees(shopId, employeeIds = []) {
  if (!shopId) {
    throw new Error("Shop id is required.");
  }

  const normalizedEmployeeIds = [...new Set(employeeIds.filter(Boolean))];

  const { error } = await supabase.rpc("assign_shop_employees", {
    employee_ids: normalizedEmployeeIds,
    target_shop_id: shopId,
  });

  if (error) {
    throw new Error(error.message || "Unable to update shop employees.");
  }

  return getShopEmployees(shopId);
}

export async function getShopSalesTargets({ month = null, year = null, shopId = null } = {}) {
  let query = supabase
    .from("shop_sales_targets")
    .select(SHOP_TARGET_FIELDS)
    .order("year", { ascending: false })
    .order("month", { ascending: false });

  if (month) query = query.eq("month", normalizeInteger(month));
  if (year) query = query.eq("year", normalizeInteger(year));
  if (shopId) query = query.eq("shop_id", shopId);

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || "Unable to load shop sales targets.");
  }

  return data || [];
}

export async function upsertShopSalesTarget({ shopId, shop_id, month, year, targetSales, target_sales, currentSales, current_sales }) {
  const targetShopId = shopId || shop_id;

  if (!targetShopId) {
    throw new Error("Shop is required.");
  }

  const period = validatePeriod(month, year);
  const userId = await getCurrentUserId();
  const payload = {
    shop_id: targetShopId,
    month: period.month,
    year: period.year,
    target_sales: normalizeNumber(targetSales ?? target_sales),
    current_sales: normalizeNumber(currentSales ?? current_sales),
    updated_by: userId,
  };

  const { data, error } = await supabase
    .from("shop_sales_targets")
    .upsert(payload, { onConflict: "shop_id,month,year" })
    .select(SHOP_TARGET_FIELDS)
    .single();

  if (error) {
    throw new Error(error.message || "Unable to save shop sales target.");
  }

  return data;
}

export function buildShopLeaderboard(targets = [], { searchTerm = "" } = {}) {
  return buildPerformanceRanking(targets, {
    searchTerm,
    useUpdatedAtTieBreaker: true,
    getName: (target) => target.shop?.name || "Unnamed shop",
  }).map((target) => ({
    ...target,
    shopName: target.shop?.name || "Unnamed shop",
  }));
}

export async function getShopMonthlyChampion(month) {
  const { data, error } = await supabase
    .from("shop_monthly_champions")
    .select(SHOP_CHAMPION_FIELDS)
    .eq("month", month)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Unable to load shop champion.");
  }

  return data;
}

export async function getShopChampionHistory({ shopId = null } = {}) {
  let query = supabase
    .from("shop_monthly_champions")
    .select(SHOP_CHAMPION_FIELDS)
    .order("month", { ascending: false });

  if (shopId) {
    query = query.eq("shop_id", shopId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || "Unable to load shop champion history.");
  }

  return data || [];
}

export function subscribeToShopTargets(onChange) {
  const channel = supabase
    .channel("shop-sales-targets-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "shop_sales_targets" },
      onChange
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToShopAssignments(onChange) {
  const channel = supabase
    .channel("profile-shop-assignments-realtime")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "profiles" },
      onChange
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export { calculateAchievement };

export default {
  buildShopLeaderboard,
  calculateAchievement,
  createShop,
  deleteShop,
  getEmployeeActiveShopAssignment,
  getShopById,
  getShopChampionHistory,
  getShopAssignmentEmployees,
  getShopEmployeeCounts,
  getShopEmployees,
  getShopMonthlyChampion,
  getShopSalesTargets,
  getShops,
  subscribeToShopAssignments,
  subscribeToShopTargets,
  updateShop,
  updateShopEmployees,
  upsertShopSalesTarget,
};
