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
  getMessagesWithUser,
  sendMessage,
  markMessageRead,
  subscribeToMessages,
};
