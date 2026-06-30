import { supabase } from "../lib/supabase";

const ANNOUNCEMENT_FIELDS = [
  "id",
  "title",
  "body",
  "created_by",
  "creator:profiles!announcements_created_by_fkey(id,full_name,email)",
  "created_at",
  "updated_at",
  "is_pinned",
  "is_active",
  "expires_at",
].join(",");

async function getCurrentUserId() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.id) {
    throw new Error(error?.message || "You must be logged in to manage announcements.");
  }

  return user.id;
}

export function validateAnnouncementDraft(payload = {}) {
  const errors = {};

  if (!payload.title?.trim()) {
    errors.title = "Title is required.";
  }

  if (!payload.body?.trim()) {
    errors.body = "Body is required.";
  }

  return errors;
}

function normalizeAnnouncementPayload(payload = {}) {
  const errors = validateAnnouncementDraft(payload);

  if (Object.keys(errors).length) {
    throw new Error(Object.values(errors)[0]);
  }

  const title = payload.title?.trim() || "";
  const body = payload.body?.trim() || "";

  return {
    title,
    body,
    is_pinned: Boolean(payload.is_pinned),
    is_active: payload.is_active !== false,
    expires_at: payload.expires_at || null,
  };
}

function normalizeAnnouncementPatch(patch = {}) {
  const updatePayload = {};

  if (Object.hasOwn(patch, "title")) {
    updatePayload.title = patch.title?.trim() || "";

    if (!updatePayload.title) {
      throw new Error(validateAnnouncementDraft({ ...patch, title: "" }).title);
    }
  }

  if (Object.hasOwn(patch, "body")) {
    updatePayload.body = patch.body?.trim() || "";

    if (!updatePayload.body) {
      throw new Error(validateAnnouncementDraft({ ...patch, body: "" }).body);
    }
  }

  if (Object.hasOwn(patch, "is_pinned")) {
    updatePayload.is_pinned = Boolean(patch.is_pinned);
  }

  if (Object.hasOwn(patch, "is_active")) {
    updatePayload.is_active = Boolean(patch.is_active);
  }

  if (Object.hasOwn(patch, "expires_at")) {
    updatePayload.expires_at = patch.expires_at || null;
  }

  return updatePayload;
}

export async function getAnnouncements() {
  const { data, error } = await supabase
    .from("announcements")
    .select(ANNOUNCEMENT_FIELDS)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Unable to load announcements.");
  }

  return data || [];
}

export async function getActiveAnnouncements() {
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("announcements")
    .select(ANNOUNCEMENT_FIELDS)
    .eq("is_active", true)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Unable to load active announcements.");
  }

  return data || [];
}

export async function createAnnouncement(payload) {
  const userId = await getCurrentUserId();
  const insertPayload = {
    ...normalizeAnnouncementPayload(payload),
    created_by: userId,
  };

  const { data, error } = await supabase
    .from("announcements")
    .insert(insertPayload)
    .select(ANNOUNCEMENT_FIELDS)
    .single();

  if (error) {
    throw new Error(error.message || "Unable to create announcement.");
  }

  return data;
}

export async function updateAnnouncement(id, patch) {
  if (!id) {
    throw new Error("Announcement id is required.");
  }

  const updatePayload = normalizeAnnouncementPatch(patch);

  const { data, error } = await supabase
    .from("announcements")
    .update(updatePayload)
    .eq("id", id)
    .select(ANNOUNCEMENT_FIELDS)
    .single();

  if (error) {
    throw new Error(error.message || "Unable to update announcement.");
  }

  return data;
}

export async function archiveAnnouncement(id) {
  if (!id) {
    throw new Error("Announcement id is required.");
  }

  const { data, error } = await supabase
    .from("announcements")
    .update({ is_active: false })
    .eq("id", id)
    .select(ANNOUNCEMENT_FIELDS)
    .single();

  if (error) {
    throw new Error(error.message || "Unable to archive announcement.");
  }

  return data;
}

export default {
  getAnnouncements,
  getActiveAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  archiveAnnouncement,
  validateAnnouncementDraft,
};
