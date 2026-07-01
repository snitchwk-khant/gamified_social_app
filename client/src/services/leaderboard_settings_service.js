import { supabase } from "../lib/supabase";

const LEADERBOARD_SETTINGS_FIELDS = "id,selected_month,selected_year,updated_at";
const SETTINGS_ID = 1;

function getCurrentPeriod() {
  const now = new Date();

  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };
}

function normalizeSettingsPeriod(settings) {
  const month = Number.parseInt(settings?.selected_month, 10);
  const year = Number.parseInt(settings?.selected_year, 10);

  if (month >= 1 && month <= 12 && year) {
    return { month, year };
  }

  return getCurrentPeriod();
}

export async function getLeaderboardSettings() {
  const { data, error } = await supabase
    .from("leaderboard_settings")
    .select(LEADERBOARD_SETTINGS_FIELDS)
    .eq("id", SETTINGS_ID)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Unable to load leaderboard settings.");
  }

  return data;
}

export async function getLeaderboardDisplayPeriod() {
  try {
    const settings = await getLeaderboardSettings();
    return normalizeSettingsPeriod(settings);
  } catch (error) {
    console.error("Leaderboard display period load error:", error);
    return getCurrentPeriod();
  }
}

export async function saveLeaderboardSettings({ selectedMonth, selectedYear }) {
  const month = Number.parseInt(selectedMonth, 10);
  const year = Number.parseInt(selectedYear, 10);

  if (month < 1 || month > 12) {
    throw new Error("Display month must be between 1 and 12.");
  }

  if (!year) {
    throw new Error("Display year is required.");
  }

  const { data, error } = await supabase
    .from("leaderboard_settings")
    .update({
      selected_month: month,
      selected_year: year,
      updated_at: new Date().toISOString(),
    })
    .eq("id", SETTINGS_ID)
    .select(LEADERBOARD_SETTINGS_FIELDS)
    .single();

  if (error) {
    throw new Error(error.message || "Unable to save leaderboard settings.");
  }

  return data;
}

export default {
  getLeaderboardDisplayPeriod,
  getLeaderboardSettings,
  saveLeaderboardSettings,
};
