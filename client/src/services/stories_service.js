import { supabase } from "../lib/supabase";

const MAX_STORY_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_STORY_VIDEO_DURATION_SECONDS = 45;
const STORY_IMAGE_ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const STORY_VIDEO_ALLOWED_EXTENSIONS = new Set(["mp4", "mov", "webm"]);
const STORY_IMAGE_ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const STORY_VIDEO_ALLOWED_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);
const STORY_TEXT_MAX_LENGTH = 300;
const STORY_BACKGROUND_OPTIONS = new Set(["purple", "pink", "blue", "orange", "green", "dark"]);

const STORY_FIELDS = [
  "id",
  "user_id",
  "media_url",
  "media_type",
  "story_type",
  "background_color",
  "caption",
  "expires_at",
  "created_at",
  "updated_at",
].join(",");

function buildStoryMediaPath(userId, file, mediaType) {
  const rawName = file?.name || "story";
  const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
  const extension = getStoryFileExtension(file, mediaType);

  return `${userId}/${Date.now()}-${safeName}.${extension}`;
}

function getStoryFileExtension(file, mediaType) {
  const extension = (file?.name?.split(".").pop() || "").toLowerCase();

  if (extension) {
    return extension;
  }

  if (mediaType === "video") {
    if (file?.type === "video/quicktime") {
      return "mov";
    }

    if (file?.type === "video/webm") {
      return "webm";
    }

    return "mp4";
  }

  if (file?.type === "image/png") {
    return "png";
  }

  if (file?.type === "image/webp") {
    return "webp";
  }

  return "jpg";
}

function getStoryMediaType(file) {
  const extension = getStoryFileExtension(file, "").toLowerCase();

  if (file?.type?.startsWith("image/") || STORY_IMAGE_ALLOWED_EXTENSIONS.has(extension)) {
    return "image";
  }

  if (file?.type?.startsWith("video/") || STORY_VIDEO_ALLOWED_EXTENSIONS.has(extension)) {
    return "video";
  }

  return "";
}

function validateStoryFile(file) {
  if (!file) {
    throw new Error("No file selected.");
  }

  if (file.size > MAX_STORY_FILE_SIZE_BYTES) {
    throw new Error("Story files must be 25 MB or smaller.");
  }

  const mediaType = getStoryMediaType(file);
  const extension = getStoryFileExtension(file, mediaType).toLowerCase();

  if (mediaType === "image") {
    if (!STORY_IMAGE_ALLOWED_EXTENSIONS.has(extension) || !STORY_IMAGE_ALLOWED_TYPES.has(file.type)) {
      throw new Error("Story images must be JPG, JPEG, PNG, or WEBP.");
    }

    return mediaType;
  }

  if (mediaType === "video") {
    if (!STORY_VIDEO_ALLOWED_EXTENSIONS.has(extension) || !STORY_VIDEO_ALLOWED_TYPES.has(file.type)) {
      throw new Error("Story videos must be MP4, MOV, or WebM.");
    }

    return mediaType;
  }

  throw new Error("Story uploads must be JPG, JPEG, PNG, WEBP, MP4, MOV, or WebM.");
}

function getVideoDuration(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
    };

    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      cleanup();
      resolve(duration);
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("Unable to read story video duration."));
    };
    video.src = objectUrl;
  });
}

export async function uploadStoryImage(file) {
  if (!file) {
    return { data: null, error: new Error("No file selected.") };
  }

  let mediaType = "";

  try {
    mediaType = validateStoryFile(file);

    if (mediaType === "video") {
      const duration = await getVideoDuration(file);

      if (duration > MAX_STORY_VIDEO_DURATION_SECONDS) {
        return { data: null, error: new Error("Story videos must be 45 seconds or less.") };
      }
    }
  } catch (error) {
    return { data: null, error };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    return { data: null, error: authError || new Error("No authenticated user found.") };
  }

  const filePath = buildStoryMediaPath(user.id, file, mediaType);
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
      mediaType,
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
  const storyIds = storyRows.map((story) => story.id).filter(Boolean);
  const userIds = [...new Set(storyRows.map((story) => story.user_id).filter(Boolean))];

  let profilesById = {};
  let viewCountsByStoryId = {};

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

  if (storyIds.length) {
    viewCountsByStoryId = await getStoryViewCounts(storyIds);
  }

  return storyRows.map((story) =>
    formatStoryRow(story, profilesById[story.user_id] || null, viewCountsByStoryId[story.id] || 0)
  );
}

export function formatStoryRow(story, profile = null, viewCount = 0) {
  const emailPrefix = profile?.email?.split("@")[0] || "";
  const authorName = profile?.full_name || emailPrefix || story?.user_id || "";
  const hasMedia = Boolean(story.media_url || story.image_url);
  const storyType = story.story_type || story.media_type || (hasMedia ? "image" : "text");

  return {
    id: story.id,
    user_id: story.user_id,
    author_name: authorName,
    author_avatar: profile?.avatar_url || null,
    profile: {
      id: profile?.id || story.user_id,
      full_name: profile?.full_name || authorName,
      avatar_url: profile?.avatar_url || null,
    },
    image_url: story.media_url || story.image_url || null,
    media_type: story.media_type || (storyType === "video" ? "video" : "image"),
    story_type: storyType,
    background_color: story.background_color || "purple",
    content: story.caption || story.content || "",
    created_at: story.created_at,
    created_at_label: story.created_at ? new Date(story.created_at).toLocaleString() : "Just now",
    expires_at: story.expires_at || null,
    updated_at: story.updated_at || story.created_at || new Date().toISOString(),
    view_count: Number(story.view_count ?? viewCount ?? 0),
  };
}

export async function formatRealtimeStory(story) {
  if (!story?.id) {
    return null;
  }

  let profile = null;

  if (story.user_id) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .eq("id", story.user_id)
      .maybeSingle();

    if (error) {
      console.error("formatRealtimeStory Profile Error:", error);
    } else {
      profile = data || null;
    }
  }

  return formatStoryRow(story, profile, story.view_count || 0);
}

async function getStoryViewCounts(storyIds) {
  const results = await Promise.all(
    storyIds.map(async (storyId) => {
      const count = await getStoryViewCount(storyId);
      return [storyId, count];
    })
  );

  return Object.fromEntries(results);
}

export async function getStoryViewCount(storyId) {
  if (!storyId) {
    return 0;
  }

  const { count, error } = await supabase
    .from("story_views")
    .select("id", { count: "exact", head: true })
    .eq("story_id", storyId);

  if (error) {
    console.error("getStoryViewCount Error:", error);
    return 0;
  }

  return count || 0;
}

export async function recordStoryView(storyId, storyOwnerId) {
  if (!storyId || !storyOwnerId) {
    return { error: null };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    const error = authError || new Error("No authenticated user found.");
    console.error("recordStoryView Auth Error:", error);
    return { error };
  }

  if (storyOwnerId === user.id) {
    return { error: null };
  }

  const { error } = await supabase.from("story_views").insert({
    story_id: storyId,
    viewer_user_id: user.id,
  });

  if (error?.code === "23505") {
    return { data: null, error: null, inserted: false };
  }

  if (error) {
    console.error("recordStoryView Error:", error);
    return { data: null, error };
  }

  return {
    data: {
      story_id: storyId,
      viewer_user_id: user.id,
    },
    error: null,
    inserted: true,
  };
}

function isActiveStory(story) {
  return !story?.expires_at || new Date(story.expires_at).getTime() > Date.now();
}

export function countActiveStoriesByUserId(stories, userId) {
  if (!userId || !Array.isArray(stories)) {
    return 0;
  }

  return stories.filter((story) => story?.user_id === userId && isActiveStory(story)).length;
}

export async function getActiveStoryCountByUserId(userId, stories = null) {
  if (!userId) {
    return 0;
  }

  if (Array.isArray(stories)) {
    return countActiveStoriesByUserId(stories, userId);
  }

  const now = new Date().toISOString();
  const { count, error } = await supabase
    .from("stories")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .or(`expires_at.is.null,expires_at.gt.${now}`);

  if (error) {
    console.error("getActiveStoryCountByUserId Error:", error);
    return 0;
  }

  return count || 0;
}

export async function createStory({
  image_url,
  media_type = "image",
  story_type,
  background_color = null,
  content = "",
}) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    return { data: null, error: authError || new Error("No authenticated user found.") };
  }

  const storyType = story_type || media_type || "image";
  const trimmedContent = content?.trim() || "";
  const safeBackground = STORY_BACKGROUND_OPTIONS.has(background_color) ? background_color : "purple";

  if (storyType === "text") {
    if (!trimmedContent) {
      return { data: null, error: new Error("Write something for your story.") };
    }

    if (trimmedContent.length > STORY_TEXT_MAX_LENGTH) {
      return { data: null, error: new Error("Text stories must be 300 characters or less.") };
    }
  }

  if (storyType !== "text" && !image_url) {
    return { data: null, error: new Error("Choose a photo or video for your story.") };
  }

  const { data, error } = await supabase
    .from("stories")
    .insert({
      user_id: user.id,
      media_url: storyType === "text" ? null : image_url,
      media_type,
      story_type: storyType,
      background_color: storyType === "text" ? safeBackground : null,
      caption: trimmedContent || null,
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

export function subscribeToStoryViews(onPayload) {
  const channel = supabase
    .channel("story-views-realtime")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "story_views",
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
  countActiveStoriesByUserId,
  formatRealtimeStory,
  formatStoryRow,
  getActiveStoryCountByUserId,
  getStoryViewCount,
  uploadStoryImage,
  createStory,
  deleteStory,
  recordStoryView,
  subscribeToStoryViews,
  subscribeToStories,
};
