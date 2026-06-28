import { supabase } from "../lib/supabase";

const ADMIN_CONFIG_FIELDS = "id,key,value,description,updated_by,created_at,updated_at";
const DEFAULT_FEATURE_FLAGS = {
  announcements_enabled: true,
  stories_enabled: true,
  chat_enabled: true,
  leaderboard_enabled: true,
  sales_enabled: true,
};

function toBoolean(value, fallback = true) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["true", "1", "yes", "on", "enabled"].includes(normalized)) {
      return true;
    }

    if (["false", "0", "no", "off", "disabled"].includes(normalized)) {
      return false;
    }
  }

  return fallback;
}

export async function getAdminConfig(key) {
  const { data, error } = await supabase
    .from("admin_configs")
    .select(ADMIN_CONFIG_FIELDS)
    .eq("key", key)
    .maybeSingle();

  if (error) {
    console.error("getAdminConfig Error:", error);
    return null;
  }

  return data;
}

export async function listAdminConfigs() {
  const { data, error } = await supabase
    .from("admin_configs")
    .select(ADMIN_CONFIG_FIELDS)
    .order("key", { ascending: true });

  if (error) {
    console.error("listAdminConfigs Error:", error);
    return [];
  }

  return data || [];
}

export async function upsertAdminConfig({ key, value, description = null }) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    return { data: null, error: authError || new Error("No authenticated user found.") };
  }

  const { data, error } = await supabase
    .from("admin_configs")
    .upsert({
      key,
      value,
      description,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "key" })
    .select(ADMIN_CONFIG_FIELDS)
    .single();

  if (error) {
    console.error("upsertAdminConfig Error:", error);
  }

  return { data, error };
}

export async function getFeatureLocks() {
  const config = await getAdminConfig("feature_locks");
  return config?.value || {};
}

export async function getFeatureFlags() {
  const configs = await listAdminConfigs();
  const flags = { ...DEFAULT_FEATURE_FLAGS };
  const configMap = new Map((configs || []).map((item) => [item.key, item.value]));

  Object.keys(flags).forEach((key) => {
    if (configMap.has(key)) {
      flags[key] = toBoolean(configMap.get(key), flags[key]);
    }
  });

  const featureLocks = configMap.get("feature_locks");
  if (featureLocks && typeof featureLocks === "object") {
    if (featureLocks.announcements?.enabled === false) flags.announcements_enabled = false;
    if (featureLocks.stories?.enabled === false) flags.stories_enabled = false;
    if (featureLocks.chat?.enabled === false) flags.chat_enabled = false;
    if (featureLocks.leaderboard?.enabled === false) flags.leaderboard_enabled = false;
    if (featureLocks.sales?.enabled === false) flags.sales_enabled = false;
  }

  return flags;
}

export default {
  getAdminConfig,
  listAdminConfigs,
  upsertAdminConfig,
  getFeatureLocks,
  getFeatureFlags,
};
