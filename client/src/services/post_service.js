import { supabase } from "../lib/supabase";

const MAX_POST_IMAGE_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const POST_IMAGE_ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const POST_IMAGE_ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function getPosts() {
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
    };
  });

  return formatted;
}

export async function createPost({ content = "", imageFile = null, imageUrl = null, isAnonymous = false }) {
  const trimmedContent = content?.trim() || "";

  if (!trimmedContent && !imageFile && !imageUrl) {
    return { data: null, error: new Error("Write something or add an image to publish.") };
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

  let uploadedImageUrl = imageUrl || null;

  if (imageFile) {
    const { data: uploadData, error: uploadError } = await uploadPostImage(user.id, imageFile);

    if (uploadError || !uploadData?.publicUrl) {
      return { data: null, error: uploadError || new Error("Unable to upload image.") };
    }

    uploadedImageUrl = uploadData.publicUrl;
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
    if (uploadedImageUrl && imageFile) {
      await deletePostImage(uploadedImageUrl, user.id);
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
    const extension = validatePostImageFile(file);
    const filePath = `${userId}/${Date.now()}.${extension}`;
    const { error } = await supabase.storage
      .from("post-images")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (error) {
      console.error("Post image upload failed:", error);
      return { data: null, error };
    }

    const { data: publicUrlData } = supabase.storage.from("post-images").getPublicUrl(filePath);
    const publicUrl = publicUrlData?.publicUrl || null;

    if (!publicUrl) {
      await supabase.storage.from("post-images").remove([filePath]);
      return { data: null, error: new Error("Unable to create image URL.") };
    }

    return { data: { path: filePath, publicUrl }, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function deletePost(postId, imageUrl = "") {
  if (!postId) {
    return { error: new Error("Missing post ID.") };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    const error = authError || new Error("No authenticated user found.");
    console.error("deletePost Auth Error:", error);
    return { error };
  }

  const { error } = await supabase
    .from("posts")
    .delete()
    .eq("id", postId)
    .eq("user_id", user.id);

  if (error) {
    console.error("deletePost Error:", error);
    return { error };
  }

  const imageDeleteError = await deletePostImage(imageUrl, user.id);

  if (imageDeleteError) {
    return { error: imageDeleteError };
  }

  return { error: null };
}

async function deletePostImage(imageUrl, userId) {
  const storagePath = getPostImageStoragePath(imageUrl, userId);

  if (!storagePath) {
    return null;
  }

  const { error } = await supabase.storage.from("post-images").remove([storagePath]);

  if (error) {
    console.error("Post image delete failed:", error);
  }

  return error || null;
}

function validatePostImageFile(file) {
  if (!file) {
    throw new Error("Choose an image to upload.");
  }

  if (file.size > MAX_POST_IMAGE_FILE_SIZE_BYTES) {
    throw new Error("Post image must be 5 MB or smaller.");
  }

  const extension = (file.name.split(".").pop() || "").toLowerCase();

  if (!POST_IMAGE_ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error("Post image must be JPG, JPEG, PNG, or WEBP.");
  }

  if (file.type && !POST_IMAGE_ALLOWED_TYPES.has(file.type)) {
    throw new Error("Post image must be JPG, JPEG, PNG, or WEBP.");
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

export default {
  getPosts,
  createPost,
  deletePost,
  subscribeToPosts,
  uploadPostImage,
};
