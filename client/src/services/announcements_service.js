import { supabase } from "../lib/supabase";

const ANNOUNCEMENT_FIELDS = [
  "id",
  "created_by",
  "title",
  "body",
  "is_pinned",
  "audience_roles",
  "starts_at",
  "ends_at",
  "created_at",
  "updated_at",
].join(",");

function normalizeRole(role) {
  const value = role?.toString().trim().toLowerCase();
  return value || null;
}

function isActiveAnnouncement(item) {
  const now = Date.now();
  const startsAt = item?.starts_at ? new Date(item.starts_at).getTime() : null;
  const endsAt = item?.ends_at ? new Date(item.ends_at).getTime() : null;
  const startsOk = startsAt === null || Number.isNaN(startsAt) || startsAt <= now;
  const endsOk = endsAt === null || Number.isNaN(endsAt) || endsAt >= now;

  return startsOk && endsOk;
}

async function getCurrentAnnouncementAccess() {
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData?.user?.id) {
    return {
      allowed: false,
      error: authError || new Error("No authenticated user found."),
      userId: null,
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, can_manage_announcements")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError) {
    return {
      allowed: false,
      error: profileError,
      userId: authData.user.id,
    };
  }

  const normalizedRole = normalizeRole(profile?.role);
  const allowed = normalizedRole === "admin" || Boolean(profile?.can_manage_announcements);

  return {
    allowed,
    error: allowed ? null : new Error("You do not have permission to manage announcements."),
    userId: authData.user.id,
  };
}

export async function getPinnedActiveAnnouncementsResult({ role = null } = {}) {
  let query = supabase
    .from("announcements")
    .select("*")
    .eq("is_pinned", true)
    .order("created_at", { ascending: false });

  const normalizedRole = normalizeRole(role);

  if (normalizedRole) {
    query = query.contains("audience_roles", [normalizedRole]);
  }

  const { data, error } = await query;

  if (error) {
    console.error("getPinnedActiveAnnouncementsResult Error:", error);
    return { data: [], error };
  }

  const activeItems = (data || []).filter((item) => isActiveAnnouncement(item));
  return { data: activeItems, error: null };
}

export async function getAnnouncements({ role = null } = {}) {
  const nowIso = new Date().toISOString();
  let query = supabase
    .from("announcements")
    .select(ANNOUNCEMENT_FIELDS)
    .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
    .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (role) {
    query = query.contains("audience_roles", [role]);
  }

  const { data, error } = await query;

  if (error) {
    console.error("getAnnouncements Error:", error);
    return [];
  }

  return data || [];
}

export async function createAnnouncement(payload) {
  const { allowed, error: accessError, userId } = await getCurrentAnnouncementAccess();

  if (!allowed || !userId) {
    return { data: null, error: accessError || new Error("No authenticated user found.") };
  }

  const insertPayload = {
    created_by: userId,
    title: payload.title?.trim(),
    body: payload.body?.trim(),
    is_pinned: Boolean(payload.is_pinned),
    audience_roles: Array.isArray(payload.audience_roles) && payload.audience_roles.length
      ? payload.audience_roles
      : ["employee", "hr", "accountant", "admin"],
    starts_at: payload.starts_at || null,
    ends_at: payload.ends_at || null,
  };

  const { data, error } = await supabase
    .from("announcements")
    .insert(insertPayload)
    .select(ANNOUNCEMENT_FIELDS)
    .single();

  if (error) {
    console.error("createAnnouncement Error:", error);
  }

  return { data, error };
}

export async function updateAnnouncement(id, patch) {
  const { allowed, error: accessError } = await getCurrentAnnouncementAccess();

  if (!allowed) {
    return { data: null, error: accessError || new Error("You do not have permission to manage announcements.") };
  }

  const { data, error } = await supabase
    .from("announcements")
    .update(patch)
    .eq("id", id)
    .select(ANNOUNCEMENT_FIELDS)
    .single();

  if (error) {
    console.error("updateAnnouncement Error:", error);
  }

  return { data, error };
}

export async function deleteAnnouncement(id) {
  const { allowed, error: accessError } = await getCurrentAnnouncementAccess();

  if (!allowed) {
    return { error: accessError || new Error("You do not have permission to manage announcements.") };
  }

  const { error } = await supabase
    .from("announcements")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("deleteAnnouncement Error:", error);
  }

  return { error };
}

export default {
  getAnnouncements,
  getPinnedActiveAnnouncementsResult,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
};
