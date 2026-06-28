import { supabase } from "../lib/supabase";

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

export async function createPost({ content, imageUrl = null, isAnonymous = false }) {
  if (!content?.trim()) return { data: null, error: new Error("Empty content") };

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    const error = authError || new Error("No authenticated user found.");
    console.error("createPost Auth Error:", error);
    return { data: null, error };
  }

  const { data, error } = await supabase
    .from("posts")
    .insert({
      user_id: user.id,
      content: content.trim(),
      image_url: imageUrl || null,
      is_anonymous: Boolean(isAnonymous),
    })
    .select()
    .single();

  if (error) {
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
  subscribeToPosts,
};
