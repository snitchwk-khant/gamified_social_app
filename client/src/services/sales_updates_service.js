import { supabase } from "../lib/supabase";

const SALES_UPDATE_FIELDS = [
  "id",
  "user_id",
  "amount",
  "sales_date",
  "created_by",
  "note",
  "created_at",
  "updated_at",
].join(",");

function normalizeRole(role) {
  const value = role?.toString().trim().toLowerCase();
  return value || null;
}

async function getCurrentSalesAccess() {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    return {
      allowed: false,
      error: authError || new Error("No authenticated user found."),
      userId: null,
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, can_manage_sales")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return {
      allowed: false,
      error: profileError,
      userId: user.id,
    };
  }

  const allowed = normalizeRole(profile?.role) === "admin" || Boolean(profile?.can_manage_sales);

  return {
    allowed,
    error: allowed ? null : new Error("You do not have permission to manage sales."),
    userId: user.id,
  };
}

export async function getSalesUpdates({ userId = null, fromDate = null, toDate = null } = {}) {
  let query = supabase
    .from("sales_updates")
    .select(SALES_UPDATE_FIELDS)
    .order("sales_date", { ascending: false });

  if (userId) {
    query = query.eq("user_id", userId);
  }

  if (fromDate) {
    query = query.gte("sales_date", fromDate);
  }

  if (toDate) {
    query = query.lte("sales_date", toDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error("getSalesUpdates Error:", error);
    return [];
  }

  return data || [];
}

export async function createSalesUpdate({ user_id, amount, sales_date, note = "" }) {
  const { allowed, error: accessError, userId } = await getCurrentSalesAccess();

  if (!allowed || !userId) {
    return { data: null, error: accessError || new Error("No authenticated user found.") };
  }

  const { data, error } = await supabase
    .from("sales_updates")
    .insert({
      user_id,
      amount: Number(amount || 0),
      sales_date,
      created_by: userId,
      note,
    })
    .select(SALES_UPDATE_FIELDS)
    .single();

  if (error) {
    console.error("createSalesUpdate Error:", error);
  }

  return { data, error };
}

export async function updateSalesUpdate(id, patch) {
  const { allowed, error: accessError } = await getCurrentSalesAccess();

  if (!allowed) {
    return { data: null, error: accessError || new Error("You do not have permission to manage sales.") };
  }

  const { data, error } = await supabase
    .from("sales_updates")
    .update(patch)
    .eq("id", id)
    .select(SALES_UPDATE_FIELDS)
    .single();

  if (error) {
    console.error("updateSalesUpdate Error:", error);
  }

  return { data, error };
}

export default {
  getSalesUpdates,
  createSalesUpdate,
  updateSalesUpdate,
};
