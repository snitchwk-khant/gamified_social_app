import { supabase } from "../lib/supabase";

const MONTHLY_CHAMPION_FIELDS = [
  "id",
  "month",
  "user_id",
  "total_points",
  "rank",
  "created_at",
  "profile:profiles!monthly_champions_user_id_fkey(id,full_name,email,avatar_url,department)",
].join(",");

export function getMonthStartDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = date.getMonth();

  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
}

export function formatChampionMonth(month) {
  if (!month) {
    return "";
  }

  return month.toString().slice(0, 7);
}

export async function refreshMonthlyChampion(month = getMonthStartDate()) {
  const { data, error } = await supabase.rpc("refresh_monthly_champion", {
    champion_month: month,
  });

  if (error) {
    throw new Error(error.message || "Unable to refresh monthly champion.");
  }

  return data;
}

export async function getMonthlyChampion(month = getMonthStartDate()) {
  const { data, error } = await supabase
    .from("monthly_champions")
    .select(MONTHLY_CHAMPION_FIELDS)
    .eq("month", month)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Unable to load monthly champion.");
  }

  return data;
}

export async function getMonthlyChampionHistory({ userId = null } = {}) {
  let query = supabase
    .from("monthly_champions")
    .select(MONTHLY_CHAMPION_FIELDS)
    .order("month", { ascending: false });

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || "Unable to load monthly champion history.");
  }

  return data || [];
}

export function subscribeToMonthlyChampions(onChange) {
  const channel = supabase
    .channel("monthly-champions-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "monthly_champions" },
      onChange
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export default {
  formatChampionMonth,
  getMonthlyChampion,
  getMonthlyChampionHistory,
  getMonthStartDate,
  refreshMonthlyChampion,
  subscribeToMonthlyChampions,
};
