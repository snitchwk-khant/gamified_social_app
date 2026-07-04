import { supabase } from "../lib/supabase";

const MAX_POST_IMAGE_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_POST_VIDEO_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const POST_IMAGE_ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const POST_IMAGE_ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const POST_VIDEO_ALLOWED_EXTENSIONS = new Set(["mp4", "mov", "webm"]);
const POST_VIDEO_ALLOWED_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);
export const POST_REACTION_OPTIONS = ["❤️"];
const DEFAULT_POST_REACTION = "❤️";

function buildReactionSummary(likeRows = [], currentUserId = "") {
  const reactionCounts = {};
  let userReaction = null;

  for (const likeRow of likeRows) {
    if (!likeRow?.post_id) {
      continue;
    }

    reactionCounts[DEFAULT_POST_REACTION] = Number(reactionCounts[DEFAULT_POST_REACTION] || 0) + 1;

    if (currentUserId && likeRow.user_id === currentUserId) {
      userReaction = DEFAULT_POST_REACTION;
    }
  }

  const reactionsCount = Object.values(reactionCounts).reduce((total, count) => total + Number(count || 0), 0);

  return {
    reaction_counts: reactionCounts,
    reactions_count: reactionsCount,
    like_count: Number(reactionCounts[DEFAULT_POST_REACTION] || 0),
    user_reaction: userReaction,
  };
}

async function getCurrentUserId() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return "";
  }

  return user?.id || "";
}

async function getLikesByPostIds(postIds = []) {
  if (!postIds.length) {
    return [];
  }

  const { data, error } = await supabase
    .from("likes")
    .select("post_id, user_id")
    .in("post_id", postIds);

  if (error) {
    console.error("getLikesByPostIds Error:", error);
    return [];
  }

  return data || [];
}

export async function getPostLoves(postId) {
  if (!postId) {
    return [];
  }

  const { data, error } = await supabase
    .from("likes")
    .select("id, user_id, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getPostLoves Error:", error);
    throw new Error(error.message || "Unable to load loves.");
  }

  const rows = data || [];
  const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))];

  if (!userIds.length) {
    return [];
  }

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url")
    .in("id", userIds);

  if (profileError) {
    console.error("getPostLoves Profiles Error:", profileError);
  }

  const profilesById = Object.fromEntries((profiles || []).map((profile) => [profile.id, profile]));

  return rows.map((row) => ({
    ...row,
    profile: profilesById[row.user_id] || null,
  }));
}

export async function getPosts() {
  const currentUserId = await getCurrentUserId();

  const { data: postsData, error } = await supabase
    .from("posts")
    .select("id, user_id, content, created_at, comments_count, image_url, is_anonymous")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getPosts Error:", error);
    return [];
  }

  const postRows = postsData || [];
  const postIds = postRows.map((post) => post.id).filter(Boolean);
  const userIds = [...new Set(postRows.map((post) => post.user_id).filter(Boolean))];
  const likeRows = await getLikesByPostIds(postIds);
  const likesByPostId = likeRows.reduce((map, likeRow) => {
    const postId = likeRow?.post_id;

    if (!postId) {
      return map;
    }

    if (!map[postId]) {
      map[postId] = [];
    }

    map[postId].push(likeRow);
    return map;
  }, {});

  let commentCountsByPostId = {};

  if (postIds.length) {
    const { data: commentRows, error: commentError } = await supabase
      .from("comments")
      .select("post_id")
      .in("post_id", postIds);

    if (commentError) {
      console.error("getPosts Comment Counts Error:", commentError);
    } else {
      commentCountsByPostId = (commentRows || []).reduce((counts, comment) => {
        if (!comment?.post_id) {
          return counts;
        }

        counts[comment.post_id] = (counts[comment.post_id] || 0) + 1;
        return counts;
      }, {});
    }
  }

  let profilesById = {};

  if (userIds.length) {
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .in("id", userIds);

    if (profileError) {
      console.error("getPosts Profiles Error:", {
        code: profileError.code,
        message: profileError.message,
        details: profileError.details,
        hint: profileError.hint,
        error: profileError,
      });
    } else {
      profilesById = Object.fromEntries((profiles || []).map((profile) => [profile.id, profile]));
    }
  }

  const formatted = postRows.map((post) => {
    const profile = profilesById[post.user_id] || null;
    const emailPrefix = profile?.email?.split("@")[0] || "";
    const authorName = profile?.full_name || emailPrefix || "";
    const reactionSummary = buildReactionSummary(likesByPostId[post.id] || [], currentUserId);

    return {
      id: post.id,
      user_id: post.user_id,
      body: post.content,
      date: new Date(post.created_at).toLocaleString(),
      comments_count: commentCountsByPostId[post.id] ?? post.comments_count ?? 0,
      is_anonymous: Boolean(post.is_anonymous),
      image_url: post.image_url || null,
      author_name: authorName,
      author_avatar: profile?.avatar_url || null,
      profile: {
        id: profile?.id || post.user_id,
        full_name: profile?.full_name || authorName,
        avatar_url: profile?.avatar_url || null,
      },
      ...reactionSummary,
    };
  });

  return formatted;
}

export async function getPostReactionSummary(postId) {
  if (!postId) {
    return {
      reaction_counts: {},
      reactions_count: 0,
      like_count: 0,
      user_reaction: null,
    };
  }

  const currentUserId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("likes")
    .select("post_id, user_id")
    .eq("post_id", postId);

  if (error) {
    console.error("getPostReactionSummary Error:", error);
    return {
      reaction_counts: {},
      reactions_count: 0,
      like_count: 0,
      user_reaction: null,
    };
  }

  return buildReactionSummary(data || [], currentUserId);
}

export async function togglePostLike(postId) {
  if (!postId) {
    return { data: null, error: new Error("Missing post ID."), summary: null };
  }

  const currentUserId = await getCurrentUserId();

  if (!currentUserId) {
    return { data: null, error: new Error("No authenticated user found."), summary: null };
  }

  const { data: existingLike, error: existingLikeError } = await supabase
    .from("likes")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", currentUserId)
    .maybeSingle();

  if (existingLikeError) {
    console.error("togglePostLike Fetch Error:", existingLikeError);
    return { data: null, error: existingLikeError, summary: null };
  }

  let mutationError = null;
  let data = null;

  if (existingLike?.id) {
    const { error } = await supabase.from("likes").delete().eq("id", existingLike.id);
    mutationError = error || null;
    data = null;
  } else {
    const insertPayload = {
      user_id: currentUserId,
      post_id: postId,
    };

    const { data: insertedLike, error } = await supabase
      .from("likes")
      .insert(insertPayload)
      .select("id, post_id, user_id")
      .single();

    mutationError = error || null;
    data = insertedLike || null;
  }

  if (mutationError) {
    console.error("togglePostLike Mutation Error:", mutationError);
    return { data: null, error: mutationError, summary: null };
  }

  const summary = await getPostReactionSummary(postId);
  return { data, error: null, summary };
}

export async function setPostReaction(postId, reaction) {
  if (!postId) {
    return { data: null, error: new Error("Missing post ID."), summary: null };
  }

  if (!POST_REACTION_OPTIONS.includes(reaction)) {
    return { data: null, error: new Error("Invalid reaction."), summary: null };
  }

  const currentUserId = await getCurrentUserId();

  if (!currentUserId) {
    return { data: null, error: new Error("No authenticated user found."), summary: null };
  }

  const { data: existingLike, error: existingLikeError } = await supabase
    .from("likes")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", currentUserId)
    .maybeSingle();

  if (existingLikeError) {
    console.error("setPostReaction Fetch Error:", existingLikeError);
    return { data: null, error: existingLikeError, summary: null };
  }

  let data = null;
  let mutationError = null;

  if (existingLike?.id) {
    data = existingLike;
    mutationError = null;
  } else {
    const { data: insertedLike, error } = await supabase
      .from("likes")
      .insert({
        user_id: currentUserId,
        post_id: postId,
      })
      .select("id, post_id, user_id")
      .single();

    data = insertedLike || null;
    mutationError = error || null;
  }

  if (mutationError) {
    console.error("setPostReaction Mutation Error:", mutationError);
    return { data: null, error: mutationError, summary: null };
  }

  const summary = await getPostReactionSummary(postId);
  return { data, error: null, summary };
}

export async function createPost({ content = "", imageFile = null, imageUrl = null, isAnonymous = false }) {
  const trimmedContent = content?.trim() || "";
  const imageFiles = Array.isArray(imageFile) ? imageFile.filter(Boolean) : imageFile ? [imageFile] : [];

  if (!trimmedContent && imageFiles.length === 0 && !imageUrl) {
    return { data: null, error: new Error("Write something or add media to publish.") };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    const error = authError || new Error("No authenticated user found.");
    console.error("createPost Auth Error:", error);
    return { data: null, error };
  }

  const uploadedImageUrls = [];
  let uploadedImageUrl = imageUrl || null;

  if (imageFiles.length) {
    for (const file of imageFiles) {
      const { data: uploadData, error: uploadError } = await uploadPostImage(user.id, file);

      if (uploadError || !uploadData?.publicUrl) {
        await deletePostImages(uploadedImageUrls, user.id);
        return { data: null, error: uploadError || new Error("Unable to upload media.") };
      }

      uploadedImageUrls.push(uploadData.publicUrl);
    }

    uploadedImageUrl = serializePostMediaUrls(uploadedImageUrls);
  }

  const { data, error } = await supabase
    .from("posts")
    .insert({
      user_id: user.id,
      content: trimmedContent,
      image_url: uploadedImageUrl,
      is_anonymous: Boolean(isAnonymous),
    })
    .select()
    .single();

  if (error) {
    if (uploadedImageUrls.length) {
      await deletePostImages(uploadedImageUrls, user.id);
    }

    console.error("createPost Insert Error:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      error,
    });
  }

  return { data, error };
}

export async function uploadPostImage(userId, file) {
  if (!userId) {
    return { data: null, error: new Error("No authenticated user found.") };
  }

  try {
    const extension = validatePostMediaFile(file);
    const uniqueSuffix =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const filePath = `${userId}/${Date.now()}-${uniqueSuffix}.${extension}`;
    const { error } = await supabase.storage
      .from("post-images")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (error) {
      console.error("Post media upload failed:", error);
      return { data: null, error };
    }

    const { data: publicUrlData } = supabase.storage.from("post-images").getPublicUrl(filePath);
    const publicUrl = publicUrlData?.publicUrl || null;

    if (!publicUrl) {
      await supabase.storage.from("post-images").remove([filePath]);
      return { data: null, error: new Error("Unable to create media URL.") };
    }

    return { data: { path: filePath, publicUrl }, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function deletePost(postId, imageUrl = "") {
  if (!postId) {
    return { data: null, error: new Error("Missing post ID.") };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    const error = authError || new Error("No authenticated user found.");
    console.error("deletePost Auth Error:", error);
    return { data: null, error };
  }

  const imageDeleteError = await deletePostImages(parsePostMediaUrls(imageUrl), user.id);

  if (imageDeleteError) {
    return { data: null, error: imageDeleteError };
  }

  const { data, error } = await supabase
    .from("posts")
    .delete()
    .eq("id", postId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("deletePost Error:", error);
    return { data: null, error };
  }

  if (!data?.id) {
    const deleteError = new Error("Post delete failed: no database row was deleted.");
    console.error("deletePost Error:", deleteError);
    return { data: null, error: deleteError };
  }

  return { data, error: null };
}

async function deletePostImage(imageUrl, userId) {
  const storagePath = getPostImageStoragePath(imageUrl, userId);

  if (!storagePath) {
    return null;
  }

  const { error } = await supabase.storage.from("post-images").remove([storagePath]);

  if (error) {
    console.error("Post media delete failed:", error);
  }

  return error || null;
}

async function deletePostImages(imageUrls, userId) {
  const urls = Array.isArray(imageUrls) ? imageUrls : parsePostMediaUrls(imageUrls);

  for (const url of urls) {
    const error = await deletePostImage(url, userId);

    if (error) {
      return error;
    }
  }

  return null;
}

function validatePostMediaFile(file) {
  if (!file) {
    throw new Error("Choose a photo or video to upload.");
  }

  const extension = (file.name.split(".").pop() || "").toLowerCase();
  const isImage = POST_IMAGE_ALLOWED_EXTENSIONS.has(extension);
  const isVideo = POST_VIDEO_ALLOWED_EXTENSIONS.has(extension);

  if (!isImage && !isVideo) {
    throw new Error("Post media must be JPG, JPEG, PNG, WEBP, MP4, MOV, or WebM.");
  }

  if (isImage && file.size > MAX_POST_IMAGE_FILE_SIZE_BYTES) {
    throw new Error("Post image must be 5 MB or smaller.");
  }

  if (isVideo && file.size > MAX_POST_VIDEO_FILE_SIZE_BYTES) {
    throw new Error("Post video must be 50 MB or smaller.");
  }

  if (file.type && isImage && !POST_IMAGE_ALLOWED_TYPES.has(file.type)) {
    throw new Error("Post image must be JPG, JPEG, PNG, or WEBP.");
  }

  if (file.type && isVideo && !POST_VIDEO_ALLOWED_TYPES.has(file.type)) {
    throw new Error("Post video must be MP4, MOV, or WebM.");
  }

  return extension;
}

function getPostImageStoragePath(imageUrl, userId) {
  if (!imageUrl || !userId) {
    return "";
  }

  try {
    const url = new URL(imageUrl);
    const marker = "/storage/v1/object/public/post-images/";
    const markerIndex = url.pathname.indexOf(marker);

    if (markerIndex === -1) {
      return "";
    }

    const storagePath = decodeURIComponent(url.pathname.slice(markerIndex + marker.length));

    if (!storagePath.startsWith(`${userId}/`)) {
      return "";
    }

    return storagePath;
  } catch {
    return "";
  }
}

export function parsePostMediaUrls(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  try {
    const parsed = JSON.parse(value);

    if (Array.isArray(parsed)) {
      return parsed.filter(Boolean);
    }
  } catch {
    return [value];
  }

  return [value];
}

function serializePostMediaUrls(urls) {
  const filteredUrls = urls.filter(Boolean);

  if (filteredUrls.length <= 1) {
    return filteredUrls[0] || null;
  }

  return JSON.stringify(filteredUrls);
}

export function subscribeToPosts(onPayload) {
  const channel = supabase
    .channel("posts-realtime")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "posts",
      },
      (payload) => {
        if (typeof onPayload === "function") onPayload(payload);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToPostLikes(postIdOrCallback, maybeCallback) {
  const hasPostFilter = typeof postIdOrCallback !== "function";
  const postId = hasPostFilter ? postIdOrCallback : "";
  const onPayload = hasPostFilter ? maybeCallback : postIdOrCallback;
  const changeConfig = {
    event: "*",
    schema: "public",
    table: "likes",
  };

  if (postId) {
    changeConfig.filter = `post_id=eq.${postId}`;
  }

  const channel = supabase
    .channel(postId ? `post-likes-realtime-${postId}` : "post-likes-realtime")
    .on(
      "postgres_changes",
      changeConfig,
      (payload) => {
        const postId = payload?.new?.post_id || payload?.old?.post_id;

        if (!postId) {
          return;
        }

        if (typeof onPayload === "function") {
          onPayload({ ...payload, postId });
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export default {
  getPosts,
  getPostReactionSummary,
  getPostLoves,
  createPost,
  deletePost,
  subscribeToPosts,
  subscribeToPostLikes,
  togglePostLike,
  setPostReaction,
  parsePostMediaUrls,
  uploadPostImage,
};
