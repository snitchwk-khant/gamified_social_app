import { supabase } from "../lib/supabase";

const MAILBOX_FIELDS = [
  "id",
  "category",
  "subject",
  "message",
  "created_at",
].join(",");

export const ANONYMOUS_MAILBOX_CATEGORIES = [
  "Suggestion",
  "Concern",
  "Workplace",
  "Safety",
  "Other",
];

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
  };
}

export async function createAnonymousMailboxMessage(payload) {
  const userId = await getCurrentUserId();
  const insertPayload = {
    ...normalizeAnonymousMailboxPayload(payload),
    user_id: userId,
  };

  const { error } = await supabase
    .from("anonymous_mailbox_messages")
    .insert(insertPayload);

  if (error) {
    throw new Error(error.message || "Unable to submit anonymous message.");
  }

  return insertPayload;
}

export async function getAnonymousMailboxMessages() {
  const { data, error } = await supabase
    .from("anonymous_mailbox_messages")
    .select(MAILBOX_FIELDS)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Unable to load anonymous messages.");
  }

  return data || [];
}

export default {
  ANONYMOUS_MAILBOX_CATEGORIES,
  createAnonymousMailboxMessage,
  getAnonymousMailboxMessages,
  validateAnonymousMailboxDraft,
};
