import { supabase } from "../lib/supabase";

const NOTIFICATION_FIELDS = "*";

function logSupabaseError(label, error) {
  console.error(`${label}:`, {
    code: error?.code,
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
    error,
  });
}

function isMissingColumnError(error) {
  return error?.code === "PGRST204" || error?.code === "42703";
}

function normalizeNotification(row) {
  const createdAt = row?.created_at || row?.inserted_at || null;
  const updatedAt = row?.updated_at || null;
  const readAt = row?.read_at || null;

  return {
    ...row,
    id: row?.id,
    user_id: row?.user_id || row?.recipient_id || null,
    actor_id: row?.actor_id || null,
    type: row?.type || row?.notification_type || "general",
    title: row?.title || row?.subject || "Notification",
    body: row?.body || row?.message || row?.content || "",
    metadata: row?.metadata || {},
    is_read: typeof row?.is_read === "boolean" ? row.is_read : Boolean(readAt),
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

async function fetchByRecipientColumn(columnName, userId) {
  return supabase
    .from("notifications")
    .select(NOTIFICATION_FIELDS)
    .eq(columnName, userId)
    .order("created_at", { ascending: false });
}

export async function getMyNotifications() {
  const { data, error } = await getMyNotificationsResult();

  if (error) {
    return [];
  }

  return data;
}

export async function getMyNotificationsResult() {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    const error = authError || new Error("No authenticated user found.");
    return { data: [], error };
  }

  const primary = await fetchByRecipientColumn("user_id", user.id);

  if (!primary.error) {
    return {
      data: (primary.data || []).map(normalizeNotification),
      error: null,
    };
  }

  if (isMissingColumnError(primary.error)) {
    const fallback = await fetchByRecipientColumn("recipient_id", user.id);

    if (!fallback.error) {
      return {
        data: (fallback.data || []).map(normalizeNotification),
        error: null,
      };
    }

    logSupabaseError("getMyNotifications Error", fallback.error);
    return { data: [], error: fallback.error };
  }

  logSupabaseError("getMyNotifications Error", primary.error);
  return { data: [], error: primary.error };

}

export async function markNotificationRead(notificationId) {
  const primary = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .select(NOTIFICATION_FIELDS)
    .single();

  if (!primary.error) {
    return { data: normalizeNotification(primary.data), error: null };
  }

  if (isMissingColumnError(primary.error)) {
    const fallback = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .select(NOTIFICATION_FIELDS)
      .single();

    if (!fallback.error) {
      return { data: normalizeNotification(fallback.data), error: null };
    }

    logSupabaseError("markNotificationRead Error", fallback.error);
    return { data: null, error: fallback.error };
  }

  logSupabaseError("markNotificationRead Error", primary.error);
  return { data: null, error: primary.error };
}

export async function createNotification(payload) {
  const { data, error } = await supabase
    .from("notifications")
    .insert(payload)
    .select(NOTIFICATION_FIELDS)
    .single();

  if (error) {
    logSupabaseError("createNotification Error", error);
  }

  return { data: data ? normalizeNotification(data) : null, error };
}

export function subscribeToMyNotifications(onPayload) {
  const channel = supabase
    .channel("notifications-realtime")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "notifications",
      },
      (payload) => {
        if (typeof onPayload === "function") {
          onPayload(payload);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export default {
  getMyNotifications,
  getMyNotificationsResult,
  markNotificationRead,
  createNotification,
  subscribeToMyNotifications,
};
