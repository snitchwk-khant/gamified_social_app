import { supabase } from "../lib/supabase";

const NOTIFICATION_FIELDS = "*";
const NOTIFICATION_WITH_ACTOR_FIELDS = NOTIFICATION_FIELDS;
const CATEGORY_FALLBACK = "System";
const NOTIFICATIONS_REALTIME_CHANNEL = "notifications-realtime";
let notificationsChannel = null;
let notificationsChannelSubscribers = new Set();
let unreadNotificationCountSubscribers = new Set();
let latestUnreadNotificationCount = 0;

function createClientUuid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  throw new Error("Unable to create notification group id.");
}

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

function notifyNotificationSubscribers(payload) {
  notificationsChannelSubscribers.forEach((subscriber) => {
    try {
      subscriber(payload);
    } catch (error) {
      console.error("notifications realtime subscriber error:", error);
    }
  });
}

function getUnreadCountFromNotifications(notifications = []) {
  return notifications.filter((notification) => !notification.is_read).length;
}

function notifyUnreadNotificationCount(count) {
  latestUnreadNotificationCount = Number(count) || 0;

  unreadNotificationCountSubscribers.forEach((subscriber) => {
    try {
      subscriber(latestUnreadNotificationCount);
    } catch (error) {
      console.error("notifications unread count subscriber error:", error);
    }
  });
}

function normalizeNotification(row) {
  const createdAt = row?.created_at || row?.inserted_at || null;
  const updatedAt = row?.updated_at || null;
  const readAt = row?.read_at || null;
  const category = row?.category || row?.type || row?.notification_type || CATEGORY_FALLBACK;
  const message = row?.message || row?.body || row?.content || "";
  const entityType = row?.entity_type || row?.metadata?.entity_type || null;
  const entityId = row?.entity_id || row?.metadata?.entity_id || null;
  const postId = row?.post_id || row?.metadata?.post_id || (entityType === "post" ? entityId : null);

  return {
    ...row,
    id: row?.id,
    user_id: row?.user_id || row?.recipient_id || null,
    actor_id: row?.actor_id || row?.created_by || null,
    created_by: row?.created_by || null,
    entity_type: entityType,
    entity_id: entityId,
    post_id: postId,
    comment_id: row?.comment_id || row?.metadata?.comment_id || null,
    shop_id: row?.shop_id || row?.metadata?.shop_id || null,
    message_id: row?.message_id || row?.metadata?.message_id || null,
    rank: row?.rank || row?.metadata?.rank || null,
    month: row?.month || row?.metadata?.month || null,
    year: row?.year || row?.metadata?.year || null,
    type: row?.type || category,
    category,
    title: row?.title || row?.subject || "Notification",
    body: message,
    message,
    metadata: row?.metadata || {},
    priority: row?.priority || "normal",
    recipient_type: row?.recipient_type || "user",
    recipient_id: row?.recipient_id || row?.user_id || null,
    notification_group_id: row?.notification_group_id || row?.id,
    is_published: typeof row?.is_published === "boolean" ? row.is_published : true,
    published_at: row?.published_at || null,
    is_read: typeof row?.is_read === "boolean" ? row.is_read : Boolean(readAt),
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

export function getNotificationActionUrl(item) {
  if (item?.metadata?.action_url) {
    return item.metadata.action_url;
  }

  if (item?.type === "post_reaction" && item?.entity_type === "post" && item?.entity_id) {
    return `/home?${new URLSearchParams({ post: item.entity_id }).toString()}`;
  }

  if (item?.type === "shop_rank_increased") {
    return "/leaderboard";
  }

  if (item?.type === "monthly_target_completed") {
    return "/monthly-champions";
  }

  if (item?.type === "direct_message") {
    const conversationId = item?.metadata?.conversation_id || item?.metadata?.sender_id || item?.actor_id || "";
    const params = new URLSearchParams();

    if (conversationId) {
      params.set("conversation", conversationId);
    }

    return `/anonymous-mailbox${params.toString() ? `?${params.toString()}` : ""}`;
  }

  if (!item?.post_id) {
    return "";
  }

  const params = new URLSearchParams({ post: item.post_id });

  if (item.type === "post_comment" || item.type === "comment_reply") {
    params.set("comments", "1");
  }

  if (item.comment_id) {
    params.set("comment", item.comment_id);
  }

  return `/home?${params.toString()}`;
}

async function fetchByRecipientColumn(columnName, userId, fields = NOTIFICATION_FIELDS, options = {}) {
  let query = supabase
    .from("notifications")
    .select(fields)
    .eq(columnName, userId);

  if (options.filterPublished !== false) {
    query = query.eq("is_published", true);
  }

  return query.order("created_at", { ascending: false });
}

async function fetchMyNotificationRows(userId, fields = NOTIFICATION_FIELDS, options = {}) {
  const shopId = await getUserShopId(userId);

  const filters = [
    `user_id.eq.${userId}`,
    `and(recipient_type.eq.user,recipient_id.eq.${userId})`,
    "recipient_type.eq.everyone",
  ];

  if (shopId) {
    filters.push(`and(recipient_type.eq.shop,recipient_id.eq.${shopId})`);
  }

  let query = supabase
    .from("notifications")
    .select(fields)
    .or(filters.join(","));

  if (options.filterPublished !== false) {
    query = query.eq("is_published", true);
  }

  return query.order("created_at", { ascending: false });
}

async function getUserShopId(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("shop_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    logSupabaseError("getUserShopId Error", error);
    return null;
  }

  return data?.shop_id || null;
}

function dedupeNotificationsById(notifications) {
  const byId = new Map();

  (notifications || []).forEach((notification) => {
    if (!notification?.id || byId.has(notification.id)) {
      return;
    }

    byId.set(notification.id, notification);
  });

  return Array.from(byId.values());
}

async function applyReadStateForUser(notifications, userId) {
  const uniqueNotifications = dedupeNotificationsById(notifications);
  const notificationIds = uniqueNotifications.map((notification) => notification.id).filter(Boolean);

  if (!notificationIds.length) {
    return [];
  }

  const { data, error } = await supabase
    .from("notification_reads")
    .select("notification_id")
    .eq("user_id", userId)
    .in("notification_id", notificationIds);

  if (error) {
    logSupabaseError("getNotificationReads Error", error);
    return notifications;
  }

  const readIds = new Set((data || []).map((row) => row.notification_id));

  return uniqueNotifications.map((notification) => ({
    ...notification,
    is_read: readIds.has(notification.id),
  }));
}

async function attachActorProfiles(notifications) {
  const uniqueNotifications = dedupeNotificationsById(notifications);
  const actorIds = Array.from(
    new Set(uniqueNotifications.map((notification) => notification.actor_id).filter(Boolean))
  );

  if (!actorIds.length) {
    return uniqueNotifications;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url")
    .in("id", actorIds);

  if (error) {
    logSupabaseError("getNotificationActorProfiles Error", error);
    return uniqueNotifications;
  }

  const profilesById = new Map((data || []).map((profile) => [profile.id, profile]));

  return uniqueNotifications.map((notification) => ({
    ...notification,
    actor: profilesById.get(notification.actor_id) || notification.actor || null,
  }));
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

  let primary = await fetchMyNotificationRows(user.id, NOTIFICATION_WITH_ACTOR_FIELDS);

  if (primary.error) {
    primary = await fetchMyNotificationRows(user.id);
  }

  if (isMissingColumnError(primary.error)) {
    primary = await fetchMyNotificationRows(user.id, NOTIFICATION_FIELDS, { filterPublished: false });
  }

  if (!primary.error) {
    const notifications = (primary.data || []).map(normalizeNotification);
    const notificationsWithActors = await attachActorProfiles(notifications);
    const notificationsWithReadState = await applyReadStateForUser(notificationsWithActors, user.id);

    notifyUnreadNotificationCount(getUnreadCountFromNotifications(notificationsWithReadState));

    return {
      data: notificationsWithReadState,
      error: null,
    };
  }

  if (isMissingColumnError(primary.error)) {
    let fallback = await fetchByRecipientColumn("recipient_id", user.id, NOTIFICATION_WITH_ACTOR_FIELDS);

    if (fallback.error) {
      fallback = await fetchByRecipientColumn("recipient_id", user.id);
    }

    if (isMissingColumnError(fallback.error)) {
      fallback = await fetchByRecipientColumn("recipient_id", user.id, NOTIFICATION_FIELDS, {
        filterPublished: false,
      });
    }

    if (!fallback.error) {
      const notifications = (fallback.data || []).map(normalizeNotification);
      const notificationsWithActors = await attachActorProfiles(notifications);
      const notificationsWithReadState = await applyReadStateForUser(notificationsWithActors, user.id);

      notifyUnreadNotificationCount(getUnreadCountFromNotifications(notificationsWithReadState));

      return {
        data: notificationsWithReadState,
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
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    const error = authError || new Error("No authenticated user found.");
    return { data: null, error };
  }

  const shopId = await getUserShopId(user.id);
  const filters = [
    `user_id.eq.${user.id}`,
    `and(recipient_type.eq.user,recipient_id.eq.${user.id})`,
    "recipient_type.eq.everyone",
  ];

  if (shopId) {
    filters.push(`and(recipient_type.eq.shop,recipient_id.eq.${shopId})`);
  }

  const notificationResult = await supabase
    .from("notifications")
    .select(NOTIFICATION_FIELDS)
    .eq("id", notificationId)
    .or(filters.join(","));

  if (notificationResult.error) {
    logSupabaseError("markNotificationRead Error", notificationResult.error);
    return { data: null, error: notificationResult.error };
  }

  const notificationRows = notificationResult.data || [];

  if (notificationRows.length !== 1) {
    const error = notificationRows.length > 1 ? new Error("Expected one notification to mark as read.") : null;

    if (error) {
      logSupabaseError("markNotificationRead Error", error);
    }

    return { data: null, error };
  }

  const { error } = await supabase
    .from("notification_reads")
    .upsert(
      {
        notification_id: notificationId,
        user_id: user.id,
      },
      {
        onConflict: "notification_id,user_id",
        ignoreDuplicates: true,
      }
    );

  if (error) {
    logSupabaseError("markNotificationRead Error", error);
    return { data: null, error };
  }

  await refreshUnreadNotificationCount();

  return {
    data: {
      ...normalizeNotification(notificationRows[0]),
      is_read: true,
    },
    error: null,
  };
}

export async function markAllNotificationsRead() {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    const error = authError || new Error("No authenticated user found.");
    return { data: [], error };
  }

  const { data: notifications, error: notificationsError } = await getMyNotificationsResult();

  if (notificationsError) {
    return { data: [], error: notificationsError };
  }

  const unreadNotificationIds = Array.from(
    new Set((notifications || []).filter((notification) => !notification.is_read).map((notification) => notification.id).filter(Boolean))
  );

  if (!unreadNotificationIds.length) {
    return { data: [], error: null };
  }

  const rows = unreadNotificationIds.map((notificationId) => ({
    notification_id: notificationId,
    user_id: user.id,
  }));

  const { error } = await supabase
    .from("notification_reads")
    .upsert(rows, {
      onConflict: "notification_id,user_id",
      ignoreDuplicates: true,
    });

  if (error) {
    logSupabaseError("markAllNotificationsRead Error", error);
    return { data: [], error };
  }

  notifyUnreadNotificationCount(0);
  await refreshUnreadNotificationCount();

  return { data: unreadNotificationIds, error: null };
}

export async function refreshUnreadNotificationCount() {
  const count = await getUnreadNotificationCount();
  notifyUnreadNotificationCount(count);
  return count;
}

export async function getUnreadNotificationCount() {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    return 0;
  }

  const { data, error } = await getMyNotificationsResult();

  if (error) {
    return 0;
  }

  return getUnreadCountFromNotifications(data || []);
}

export function subscribeToUnreadNotificationCount(onCount) {
  let isActive = true;

  const loadUnreadCount = async () => {
    const count = await refreshUnreadNotificationCount();

    if (isActive && typeof onCount === "function") {
      onCount(count);
    }
  };

  if (typeof onCount === "function") {
    unreadNotificationCountSubscribers.add(onCount);
    onCount(latestUnreadNotificationCount);
  }

  loadUnreadCount();

  const unsubscribe = subscribeToMyNotifications(loadUnreadCount);

  return () => {
    isActive = false;

    if (typeof onCount === "function") {
      unreadNotificationCountSubscribers.delete(onCount);
    }

    if (typeof unsubscribe === "function") {
      unsubscribe();
    }
  };
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

export async function createSocialNotification({ recipientId, type, postId, commentId = null }) {
  if (!recipientId || !type || !postId) {
    return { data: null, error: new Error("Missing social notification fields.") };
  }

  if (type === "post_reaction") {
    return { data: null, error: null };
  }

  const { data, error } = await supabase.rpc("create_social_notification", {
    target_user_id: recipientId,
    notification_type: type,
    source_post_id: postId,
    source_comment_id: commentId,
  });

  if (error) {
    logSupabaseError("createSocialNotification Error", error);
  }

  return { data, error };
}

export async function createAdminNotifications({
  title,
  message,
  category,
  priority,
  recipients,
  recipientType,
  recipientId,
  notificationGroupId,
  isPublished = true,
}) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    throw new Error(authError?.message || "You must be logged in to create notifications.");
  }

  const normalizedRecipients = Array.from(new Set((recipients || []).filter(Boolean)));
  const normalizedRecipientType = recipientType || "user";

  if (normalizedRecipientType === "user" && !normalizedRecipients.length) {
    throw new Error("Select at least one notification recipient.");
  }

  const normalizedCategory = category || CATEGORY_FALLBACK;
  const groupId = notificationGroupId || createClientUuid();
  const published = Boolean(isPublished);
  const publishedAt = published ? new Date().toISOString() : null;
  const targetUserId = normalizedRecipientType === "user" ? normalizedRecipients[0] : user.id;
  const row = {
    notification_group_id: groupId,
    user_id: targetUserId,
    recipient_type: normalizedRecipientType,
    recipient_id: normalizedRecipientType === "everyone" ? null : recipientId || targetUserId,
    title: title?.trim() || "Notification",
    body: message?.trim() || "",
    message: message?.trim() || "",
    type: normalizedCategory,
    category: normalizedCategory,
    priority: priority || "normal",
    created_by: user.id,
    is_published: published,
    published_at: publishedAt,
    is_read: false,
  };

  const { data, error } = await supabase
    .from("notifications")
    .insert(row)
    .select(NOTIFICATION_FIELDS)
    .single();

  if (error) {
    logSupabaseError("createAdminNotifications Error", error);
    throw new Error(error.message || "Unable to create notification.");
  }

  return data ? [normalizeNotification(data)] : [];
}

export async function getAdminNotificationGroups() {
  const { data, error } = await supabase
    .from("notifications")
    .select(NOTIFICATION_FIELDS)
    .order("created_at", { ascending: false });

  if (error) {
    logSupabaseError("getAdminNotificationGroups Error", error);
    throw new Error(error.message || "Unable to load notifications.");
  }

  const groups = new Map();

  (data || []).map(normalizeNotification).forEach((notification) => {
    const groupId = notification.notification_group_id || notification.id;
    const current = groups.get(groupId);

    if (!current) {
      groups.set(groupId, {
        ...notification,
        notification_group_id: groupId,
        recipient_count: 1,
        recipients: [notification.user_id],
      });
      return;
    }

    current.recipient_count += 1;
    current.recipients.push(notification.user_id);
  });

  return Array.from(groups.values());
}

export async function deleteAdminNotificationGroup(groupId) {
  if (!groupId) {
    throw new Error("Notification id is required.");
  }

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("notification_group_id", groupId);

  if (error) {
    logSupabaseError("deleteAdminNotificationGroup Error", error);
    throw new Error(error.message || "Unable to delete notification.");
  }
}

export async function updateAdminNotificationPublishState(groupId, isPublished) {
  if (!groupId) {
    throw new Error("Notification id is required.");
  }

  const { data, error } = await supabase
    .from("notifications")
    .update({
      is_published: Boolean(isPublished),
      published_at: isPublished ? new Date().toISOString() : null,
    })
    .eq("notification_group_id", groupId)
    .select(NOTIFICATION_FIELDS);

  if (error) {
    logSupabaseError("updateAdminNotificationPublishState Error", error);
    throw new Error(error.message || "Unable to update notification.");
  }

  return (data || []).map(normalizeNotification);
}

export async function replaceAdminNotificationGroup(groupId, payload) {
  await deleteAdminNotificationGroup(groupId);
  return createAdminNotifications(payload);
}

export function subscribeToMyNotifications(onPayload) {
  if (typeof onPayload === "function") {
    notificationsChannelSubscribers.add(onPayload);
  }

  if (!notificationsChannel) {
    try {
      const channel = supabase.channel(NOTIFICATIONS_REALTIME_CHANNEL);

      ["INSERT", "UPDATE", "DELETE"].forEach((event) => {
        channel.on(
          "postgres_changes",
          {
            event,
            schema: "public",
            table: "notifications",
          },
          notifyNotificationSubscribers
        );

        channel.on(
          "postgres_changes",
          {
            event,
            schema: "public",
            table: "notification_reads",
          },
          notifyNotificationSubscribers
        );
      });

      notificationsChannel = channel;
      channel.subscribe((status, error) => {
        if (error) {
          logSupabaseError("notifications realtime subscribe error", error);
        }
      });
    } catch (error) {
      console.error("notifications realtime setup error:", error);
    }
  }

  return () => {
    if (typeof onPayload === "function") {
      notificationsChannelSubscribers.delete(onPayload);
    }

    if (!notificationsChannelSubscribers.size && notificationsChannel) {
      const channel = notificationsChannel;
      notificationsChannel = null;
      supabase.removeChannel(channel);
    }
  };
}

export default {
  getMyNotifications,
  getMyNotificationsResult,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadNotificationCount,
  refreshUnreadNotificationCount,
  subscribeToUnreadNotificationCount,
  createNotification,
  createSocialNotification,
  getNotificationActionUrl,
  createAdminNotifications,
  getAdminNotificationGroups,
  deleteAdminNotificationGroup,
  updateAdminNotificationPublishState,
  replaceAdminNotificationGroup,
  subscribeToMyNotifications,
};
