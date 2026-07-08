import { supabase } from "../lib/supabase";

const MAILBOX_FIELDS = [
  "id",
  "category",
  "subject",
  "message",
  "sender_id",
  "recipient_id",
  "is_anonymous",
  "created_at",
].join(",");

export const ANONYMOUS_MAILBOX_CATEGORIES = [
  "Suggestion",
  "Concern",
  "Workplace",
  "Safety",
  "Other",
];

const MAILBOX_RECIPIENT_FIELDS = "id,full_name,email,avatar_url,role";

async function getCurrentUserId() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.id) {
    throw new Error(error?.message || "You must be logged in to submit a message.");
  }

  return user.id;
}

export function validateAnonymousMailboxDraft(payload = {}) {
  const errors = {};

  if (!payload.recipient_id) {
    errors.recipient_id = "Recipient is required.";
  }

  if (!payload.category?.trim()) {
    errors.category = "Category is required.";
  }

  if (!payload.subject?.trim()) {
    errors.subject = "Subject is required.";
  }

  if (!payload.message?.trim()) {
    errors.message = "Message is required.";
  }

  return errors;
}

function normalizeAnonymousMailboxPayload(payload = {}) {
  const errors = validateAnonymousMailboxDraft(payload);

  if (Object.keys(errors).length) {
    throw new Error(Object.values(errors)[0]);
  }

  return {
    category: payload.category.trim(),
    subject: payload.subject.trim(),
    message: payload.message.trim(),
    recipient_id: payload.recipient_id,
    is_anonymous: payload.is_anonymous !== false,
  };
}

export async function createAnonymousMailboxMessage(payload) {
  const userId = await getCurrentUserId();
  const insertPayload = {
    ...normalizeAnonymousMailboxPayload(payload),
    user_id: userId,
    sender_id: userId,
  };

  const { error } = await supabase
    .from("anonymous_mailbox_messages")
    .insert(insertPayload);

  if (error) {
    throw new Error(error.message || "Unable to submit anonymous message.");
  }

  return insertPayload;
}

export async function getAnonymousMailboxRecipients() {
  const { data, error } = await supabase
    .from("profiles")
    .select(MAILBOX_RECIPIENT_FIELDS)
    .in("role", ["admin", "accountant"])
    .order("full_name", { ascending: true });

  if (error) {
    throw new Error(error.message || "Unable to load recipients.");
  }

  return data || [];
}

export async function getAnonymousMailboxMessages() {
  const { data, error } = await supabase
    .from("anonymous_mailbox_messages")
    .select(MAILBOX_FIELDS)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Unable to load anonymous messages.");
  }

  const rows = data || [];
  const visibleSenderIds = [
    ...new Set(rows.filter((row) => row.is_anonymous === false && row.sender_id).map((row) => row.sender_id)),
  ];
  let sendersById = {};

  if (visibleSenderIds.length) {
    const { data: senderRows, error: senderError } = await supabase
      .from("profiles")
      .select("id,full_name,email,avatar_url")
      .in("id", visibleSenderIds);

    if (senderError) {
      throw new Error(senderError.message || "Unable to load message senders.");
    }

    sendersById = Object.fromEntries((senderRows || []).map((sender) => [sender.id, sender]));
  }

  return rows.map((row) => ({
    ...row,
    sender_id: row.is_anonymous === false ? row.sender_id : null,
    sender: row.is_anonymous === false ? sendersById[row.sender_id] || null : null,
  }));
}

export default {
  ANONYMOUS_MAILBOX_CATEGORIES,
  createAnonymousMailboxMessage,
  getAnonymousMailboxRecipients,
  getAnonymousMailboxMessages,
  validateAnonymousMailboxDraft,
};
