import { supabase } from "../lib/supabase";

const STORY_FIELDS = [
  "id",
  "user_id",
  "media_url",
  "media_type",
  "caption",
  "expires_at",
  "created_at",
  "updated_at",
].join(",");

function buildStoryImagePath(userId, file) {
  const rawName = file?.name || "story";
  const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
  const extensionFromType =
    file?.type === "image/png"
      ? "png"
      : file?.type === "image/webp"
      ? "webp"
      : file?.type === "image/gif"
      ? "gif"
      : "jpg";

  return `${userId}/${Date.now()}-${safeName}.${extensionFromType}`;
}

export async function uploadStoryImage(file) {
  if (!file) {
    return { data: null, error: new Error("No file selected.") };
  }

  if (!file.type?.startsWith("image/")) {
    return { data: null, error: new Error("Story uploads must be images.") };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    return { data: null, error: authError || new Error("No authenticated user found.") };
  }

  const filePath = buildStoryImagePath(user.id, file);
  const { error: uploadError } = await supabase.storage
    .from("stories")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (uploadError) {
    console.error("uploadStoryImage Error:", uploadError);
    return { data: null, error: uploadError };
  }

  const { data } = supabase.storage.from("stories").getPublicUrl(filePath);

  return {
    data: {
      path: filePath,
      publicUrl: data?.publicUrl || null,
    },
    error: null,
  };
}

export async function getStories() {
  const { data, error } = await supabase
    .from("stories")
    .select(STORY_FIELDS)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getStories Error:", error);
    return [];
  }

  const storyRows = data || [];
  const userIds = [...new Set(storyRows.map((story) => story.user_id).filter(Boolean))];

  let profilesById = {};

  if (userIds.length) {
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .in("id", userIds);

    if (profileError) {
      console.error("getStories Profiles Error:", profileError);
    } else {
      profilesById = Object.fromEntries((profiles || []).map((profile) => [profile.id, profile]));
    }
  }

  return storyRows.map((story) => {
    const profile = profilesById[story.user_id] || null;
    const emailPrefix = profile?.email?.split("@")[0] || "";
    const authorName = profile?.full_name || emailPrefix || "User";

    return {
      id: story.id,
      user_id: story.user_id,
      author_name: authorName,
      author_avatar: profile?.avatar_url || null,
      image_url: story.media_url || null,
      content: story.caption || "",
      created_at: story.created_at,
      created_at_label: new Date(story.created_at).toLocaleString(),
      expires_at: story.expires_at,
      updated_at: story.updated_at,
    };
  });
}

export async function createStory({ image_url, content = "" }) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    return { data: null, error: authError || new Error("No authenticated user found.") };
  }

  const { data, error } = await supabase
    .from("stories")
    .insert({
      user_id: user.id,
      media_url: image_url,
      media_type: "image",
      caption: content?.trim() || null,
    })
    .select(STORY_FIELDS)
    .single();

  if (error) {
    console.error("createStory Error:", error);
  }

  return { data, error };
}

export async function deleteStory(storyId) {
  const { error } = await supabase.from("stories").delete().eq("id", storyId);

  if (error) {
    console.error("deleteStory Error:", error);
  }

  return { error };
}

export function subscribeToStories(onPayload) {
  const channel = supabase
    .channel("stories-realtime")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "stories",
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
  getStories,
  uploadStoryImage,
  createStory,
  deleteStory,
  subscribeToStories,
};
