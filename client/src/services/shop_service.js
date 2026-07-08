import { supabase } from "../lib/supabase";
import { calculateAchievement } from "./ranking_service";
import { buildShopHistoryRanking } from "./shop_history_calculation_service";

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

const SHOP_HISTORY_EMPLOYEE_FIELDS = [
  "id",
  "shop_id",
  "year",
  "month",
  "employee_id",
  "created_at",
  "employee:profiles!shop_history_employees_employee_id_fkey(id,full_name,email,avatar_url,role)",
].join(",");

let shopTargetsChannel = null;
const shopTargetSubscribers = new Set();
let shopAssignmentsChannel = null;
const shopAssignmentSubscribers = new Set();
let shopHistoryEmployeesChannel = null;
const shopHistoryEmployeeSubscribers = new Set();

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
  const currentEmployees = await getShopEmployees(shopId);
  const selectedEmployeeIds = new Set(normalizedEmployeeIds);
  const removedEmployeeIds = currentEmployees
    .filter((employee) => !selectedEmployeeIds.has(employee.id))
    .map((employee) => employee.id);

  if (removedEmployeeIds.length) {
    const { error: unassignError } = await supabase
      .from("profiles")
      .update({ shop_id: null })
      .eq("shop_id", shopId)
      .eq("role", "employee")
      .in("id", removedEmployeeIds);

    if (unassignError) {
      throw new Error(unassignError.message || "Unable to remove shop employees.");
    }
  }

  if (!normalizedEmployeeIds.length) {
    return getShopEmployees(shopId);
  }

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

export async function upsertShopSalesTarget({
  currentSales,
  current_sales,
  month,
  shopId,
  shop_id,
  targetSales,
  target_sales,
  year,
}) {
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

export async function deleteShopSalesTarget(targetId) {
  if (!targetId) {
    throw new Error("Shop target id is required.");
  }

  const { data, error } = await supabase
    .from("shop_sales_targets")
    .delete()
    .eq("id", targetId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Unable to delete shop sales target.");
  }

  if (!data?.id) {
    throw new Error("Shop sales target was not found.");
  }

  return data;
}

export async function getShopHistoryEmployees({ shopId = null, month = null, year = null } = {}) {
  let query = supabase
    .from("shop_history_employees")
    .select(SHOP_HISTORY_EMPLOYEE_FIELDS)
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .order("created_at", { ascending: true });

  if (shopId) query = query.eq("shop_id", shopId);
  if (month) query = query.eq("month", normalizeInteger(month));
  if (year) query = query.eq("year", normalizeInteger(year));

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || "Unable to load shop history employees.");
  }

  return data || [];
}

export function buildSharedShopHistoryRecords(targets = [], historyEmployees = []) {
  const employeesByPeriod = historyEmployees.reduce((groups, row) => {
    const key = `${row.shop_id}-${row.year}-${row.month}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    if (row.employee_id) {
      groups.get(key).push(row);
    }

    return groups;
  }, new Map());

  return targets.map((target) => {
    const key = `${target.shop_id}-${target.year}-${target.month}`;
    const employeeRows = employeesByPeriod.get(key) || [];

    return {
      ...target,
      employeeIds: employeeRows.map((row) => row.employee_id).filter(Boolean),
      employees: employeeRows.map((row) => row.employee).filter(Boolean),
      historyEmployees: employeeRows,
    };
  });
}

export async function getSharedShopHistoryRecords({ shopId = null, month = null, year = null } = {}) {
  const [targetRows, historyEmployeeRows] = await Promise.all([
    getShopSalesTargets({ shopId, month, year }),
    getShopHistoryEmployees({ shopId, month, year }),
  ]);

  return buildSharedShopHistoryRecords(targetRows, historyEmployeeRows);
}

export async function saveShopHistoryEmployees({ shopId, month, year, employeeIds = [] }) {
  if (!shopId) {
    throw new Error("Shop is required.");
  }

  const period = validatePeriod(month, year);
  const normalizedEmployeeIds = [...new Set(employeeIds.filter(Boolean))];

  const { error: deleteError } = await supabase
    .from("shop_history_employees")
    .delete()
    .eq("shop_id", shopId)
    .eq("month", period.month)
    .eq("year", period.year);

  if (deleteError) {
    throw new Error(deleteError.message || "Unable to update shop history employees.");
  }

  if (normalizedEmployeeIds.length) {
    const { error: insertError } = await supabase
      .from("shop_history_employees")
      .insert(
        normalizedEmployeeIds.map((employeeId) => ({
          employee_id: employeeId,
          month: period.month,
          shop_id: shopId,
          year: period.year,
        }))
      );

    if (insertError) {
      throw new Error(insertError.message || "Unable to save shop history employees.");
    }
  }

  return getShopHistoryEmployees({
    shopId,
    month: period.month,
    year: period.year,
  });
}

export async function deleteShopHistoryEmployees({ shopId, month, year }) {
  if (!shopId) {
    throw new Error("Shop is required.");
  }

  const period = validatePeriod(month, year);
  const { error } = await supabase
    .from("shop_history_employees")
    .delete()
    .eq("shop_id", shopId)
    .eq("month", period.month)
    .eq("year", period.year);

  if (error) {
    throw new Error(error.message || "Unable to delete shop history employees.");
  }
}

export function buildShopLeaderboard(targets = [], { searchTerm = "" } = {}) {
  return buildShopHistoryRanking(targets, { searchTerm });
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
  shopTargetSubscribers.add(onChange);

  if (!shopTargetsChannel) {
    shopTargetsChannel = supabase
      .channel("shop-sales-targets-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shop_sales_targets" },
        (payload) => {
          shopTargetSubscribers.forEach((subscriber) => subscriber(payload));
        }
      )
      .subscribe();
  }

  return () => {
    shopTargetSubscribers.delete(onChange);

    if (!shopTargetSubscribers.size && shopTargetsChannel) {
      supabase.removeChannel(shopTargetsChannel);
      shopTargetsChannel = null;
    }
  };
}

export function subscribeToShopAssignments(onChange) {
  shopAssignmentSubscribers.add(onChange);

  if (!shopAssignmentsChannel) {
    shopAssignmentsChannel = supabase
      .channel("profile-shop-assignments-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        (payload) => {
          shopAssignmentSubscribers.forEach((subscriber) => subscriber(payload));
        }
      )
      .subscribe();
  }

  return () => {
    shopAssignmentSubscribers.delete(onChange);

    if (!shopAssignmentSubscribers.size && shopAssignmentsChannel) {
      supabase.removeChannel(shopAssignmentsChannel);
      shopAssignmentsChannel = null;
    }
  };
}

export function subscribeToShopHistoryEmployees(onChange) {
  shopHistoryEmployeeSubscribers.add(onChange);

  if (!shopHistoryEmployeesChannel) {
    shopHistoryEmployeesChannel = supabase
      .channel("shop-history-employees-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shop_history_employees" },
        (payload) => {
          shopHistoryEmployeeSubscribers.forEach((subscriber) => subscriber(payload));
        }
      )
      .subscribe();
  }

  return () => {
    shopHistoryEmployeeSubscribers.delete(onChange);

    if (!shopHistoryEmployeeSubscribers.size && shopHistoryEmployeesChannel) {
      supabase.removeChannel(shopHistoryEmployeesChannel);
      shopHistoryEmployeesChannel = null;
    }
  };
}

export { calculateAchievement };

export default {
  buildShopLeaderboard,
  buildSharedShopHistoryRecords,
  calculateAchievement,
  createShop,
  deleteShop,
  deleteShopHistoryEmployees,
  deleteShopSalesTarget,
  getEmployeeActiveShopAssignment,
  getShopById,
  getShopChampionHistory,
  getShopAssignmentEmployees,
  getShopEmployeeCounts,
  getShopEmployees,
  getShopHistoryEmployees,
  getSharedShopHistoryRecords,
  getShopMonthlyChampion,
  getShopSalesTargets,
  getShops,
  subscribeToShopAssignments,
  subscribeToShopHistoryEmployees,
  subscribeToShopTargets,
  saveShopHistoryEmployees,
  updateShop,
  updateShopEmployees,
  upsertShopSalesTarget,
};
