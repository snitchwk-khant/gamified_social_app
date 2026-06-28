import { useEffect, useState } from "react";
import { useAuth } from "../../context/auth_context";
import { useTheme } from "../../context/theme_context";
import { supabase } from "../../lib/supabase";
import CommentForm from "./comment_form";
import CommentList from "./comment_list";

function PostCard({
  id,
  body,
  date,
  commentsCount = 0,
  isAnonymous = false,
  authorName = "User",
  authorAvatar = null,
}) {
  const { user } = useAuth();
  const { isDark } = useTheme();

  const [comments, setComments] = useState([]);
  const [commentOpen, setCommentOpen] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentCount, setCommentCount] = useState(commentsCount);
  const maskedAvatarPath = "/masked-avatar.jpg";

  async function loadComments() {
    setLoadingComments(true);

    const { data, error } = await supabase
      .from("comments")
      .select("id, content, created_at, is_anonymous, user_id")
      .eq("post_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Load Comments Error:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        error,
      });
      setComments([]);
      setCommentCount(0);
      setLoadingComments(false);
      return;
    }

    const commentRows = data || [];
    const authorIds = [
      ...new Set(commentRows.filter((comment) => !comment.is_anonymous && comment.user_id).map((comment) => comment.user_id)),
    ];

    let profileMap = {};

    if (authorIds.length) {
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", authorIds);

      if (profileError) {
        console.error("Load Comment Profiles Error:", {
          code: profileError.code,
          message: profileError.message,
          details: profileError.details,
          hint: profileError.hint,
          error: profileError,
        });
      } else {
        profileMap = Object.fromEntries((profiles || []).map((profile) => [profile.id, profile]));
      }
    }

    const formattedComments = commentRows.map((comment) => {
      const profile = !comment.is_anonymous ? profileMap[comment.user_id] : null;

      return {
        ...comment,
        author_name: comment.is_anonymous ? "Masked" : profile?.full_name || "User",
        author_avatar: comment.is_anonymous ? maskedAvatarPath : profile?.avatar_url || null,
      };
    });

    setComments(formattedComments);
    setCommentCount(formattedComments.length);
    setLoadingComments(false);
  }

  useEffect(() => {
    if (!commentOpen) return;

    loadComments();

    const channel = supabase
      .channel(`comments-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
          filter: `post_id=eq.${id}`,
        },
        () => {
          loadComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [commentOpen, id]);

  async function handleCommentSubmit(content, isAnonymous = false) {
    if (!user?.id) return false;

    const trimmedContent = content?.trim();
    if (!trimmedContent) return false;

    const { error } = await supabase.from("comments").insert({
      post_id: id,
      user_id: user.id,
      content: trimmedContent,
      is_anonymous: isAnonymous,
    });

    if (error) {
      console.error("Comment Insert Error:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        error,
      });
      return false;
    }

    await loadComments();

    return true;
  }

  return (
    <article
      className={`rounded-2xl border p-6 ${
        isDark ? "border-slate-800 bg-slate-900 shadow-xl" : "border-slate-200 bg-white shadow-sm"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {isAnonymous ? (
            <img
              src={maskedAvatarPath}
              alt="Masked"
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : authorAvatar ? (
            <img
              src={authorAvatar}
              alt={authorName}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${
                isDark ? "bg-slate-700 text-white" : "bg-slate-200 text-slate-700"
              }`}
            >
              {(authorName?.charAt(0) || "U").toUpperCase()}
            </div>
          )}

          <p className={`truncate text-sm font-medium ${isDark ? "text-slate-200" : "text-slate-900"}`}>
            {isAnonymous ? "Masked" : authorName}
          </p>
        </div>

        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs ${
            isDark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"
          }`}
        >
          {date}
        </span>
      </div>

      <p className={`mt-4 whitespace-pre-wrap ${isDark ? "text-slate-300" : "text-slate-700"}`}>
        {body}
      </p>

      <div className="mt-5 flex items-center gap-4">
        <button
          onClick={() => setCommentOpen(!commentOpen)}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            isDark
              ? "bg-slate-800 text-white hover:bg-sky-500"
              : "bg-[#f6e8ff] text-[#c446ff] hover:bg-[#edd4ff]"
          }`}
        >
          💬 Comment
        </button>

        <span className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          {commentCount} Comments
        </span>
      </div>

      {commentOpen && (
        <div
          className={`mt-5 rounded-2xl border p-5 ${
            isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-slate-50"
          }`}
        >
          <CommentForm onSubmit={handleCommentSubmit} />

          <div className="mt-5">
            <CommentList
              comments={comments}
              loading={loadingComments}
            />
          </div>
        </div>
      )}
    </article>
  );
}

export default PostCard;