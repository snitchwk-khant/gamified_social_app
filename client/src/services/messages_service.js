import { supabase } from "../lib/supabase";

const MESSAGE_FIELDS = [
  "id",
  "sender_id",
  "receiver_id",
  "content",
  "is_read",
  "created_at",
  "updated_at",
].join(",");

const TEAM_MESSAGE_MAX_LENGTH = 1000;
const TEAM_MESSAGE_FIELDS = `
  id,
  user_id,
  message,
  created_at,
  profile:profiles!team_messages_user_id_fkey (
    id,
    full_name,
    avatar_url,
    department
  )
`;

function formatTeamMessage(row, currentUserId = "") {
  const profile = row?.profile || {};
  const displayName = profile.full_name || "Team member";

  return {
    id: row.id,
    user_id: row.user_id,
    author: displayName,
    author_avatar: profile.avatar_url || null,
    department: profile.department || "No department",
    content: row.message || "",
    created_at: row.created_at,
    time: row.created_at
      ? new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "Now",
    isOwn: Boolean(currentUserId && row.user_id === currentUserId),
    profilePath: currentUserId && row.user_id === currentUserId ? "/profile" : `/profile/${row.user_id}`,
  };
}

export async function getTeamMessages() {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    return { data: [], error: authError || new Error("No authenticated user found.") };
  }

  const { data, error } = await supabase
    .from("team_messages")
    .select(TEAM_MESSAGE_FIELDS)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("getTeamMessages Error:", error);
    return { data: [], error };
  }

  return {
    data: (data || []).map((row) => formatTeamMessage(row, user.id)),
    error: null,
  };
}

export async function getTeamMessageById(messageId) {
  if (!messageId) {
    return { data: null, error: new Error("Message id is required.") };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    return { data: null, error: authError || new Error("No authenticated user found.") };
  }

  const { data, error } = await supabase
    .from("team_messages")
    .select(TEAM_MESSAGE_FIELDS)
    .eq("id", messageId)
    .maybeSingle();

  if (error) {
    console.error("getTeamMessageById Error:", error);
    return { data: null, error };
  }

  return { data: data ? formatTeamMessage(data, user.id) : null, error: null };
}

export async function sendTeamMessage(content) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    return { data: null, error: authError || new Error("No authenticated user found.") };
  }

  const trimmed = content?.trim();

  if (!trimmed) {
    return { data: null, error: new Error("Message content is required.") };
  }

  if (trimmed.length > TEAM_MESSAGE_MAX_LENGTH) {
    return { data: null, error: new Error("Messages must be 1000 characters or less.") };
  }

  const { data, error } = await supabase
    .from("team_messages")
    .insert({
      user_id: user.id,
      message: trimmed,
    })
    .select(TEAM_MESSAGE_FIELDS)
    .single();

  if (error) {
    console.error("sendTeamMessage Error:", error);
    return { data: null, error };
  }

  return { data: formatTeamMessage(data, user.id), error: null };
}

export function subscribeToTeamMessages(onPayload, onStatusChange) {
  const channel = supabase
    .channel("team-messages-realtime")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "team_messages",
      },
      (payload) => {
        if (typeof onPayload === "function") {
          onPayload(payload);
        }
      }
    )
    .subscribe((status) => {
      if (typeof onStatusChange === "function") {
        onStatusChange(status);
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function getMessagesWithUser(otherUserId) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.id || !otherUserId) {
    return [];
  }

  const { data, error } = await supabase
    .from("messages")
    .select(MESSAGE_FIELDS)
    .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("getMessagesWithUser Error:", error);
    return [];
  }

  return data || [];
}

export async function sendMessage({ receiver_id, content }) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    return { data: null, error: authError || new Error("No authenticated user found.") };
  }

  const trimmed = content?.trim();
  if (!trimmed) {
    return { data: null, error: new Error("Message content is required.") };
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      sender_id: user.id,
      receiver_id,
      content: trimmed,
    })
    .select(MESSAGE_FIELDS)
    .single();

  if (error) {
    console.error("sendMessage Error:", error);
  }

  return { data, error };
}

export async function markMessageRead(messageId) {
  const { data, error } = await supabase
    .from("messages")
    .update({ is_read: true })
    .eq("id", messageId)
    .select(MESSAGE_FIELDS)
    .single();

  if (error) {
    console.error("markMessageRead Error:", error);
  }

  return { data, error };
}

export function subscribeToMessages(onPayload) {
  const channel = supabase
    .channel("messages-realtime")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "messages",
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
  getTeamMessages,
  getTeamMessageById,
  sendTeamMessage,
  subscribeToTeamMessages,
  getMessagesWithUser,
  sendMessage,
  markMessageRead,
  subscribeToMessages,
};
