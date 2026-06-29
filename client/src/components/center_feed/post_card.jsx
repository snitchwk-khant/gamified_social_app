import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
  authorUserId = null,
  authorName = "",
  authorAvatar = null,
  imageUrl = null,
  profile = null,
  onCommentCreated,
  onDeletePost,
}) {
  const { user } = useAuth();
  const { isDark } = useTheme();

  const [comments, setComments] = useState([]);
  const [commentOpen, setCommentOpen] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentCount, setCommentCount] = useState(commentsCount);
  const [deleting, setDeleting] = useState(false);
  const maskedAvatarPath = "/masked-avatar.jpg";
  const canDelete = Boolean(user?.id && authorUserId === user.id);

  useEffect(() => {
    setCommentCount(commentsCount);
  }, [commentsCount, id]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const avatarUrl = user.avatar_url || null;

    setComments((currentComments) =>
      currentComments.map((comment) => {
        if (comment.is_anonymous || comment.user_id !== user.id) {
          return comment;
        }

        return {
          ...comment,
          author_avatar: avatarUrl,
          profile: comment.profile
            ? {
                ...comment.profile,
                avatar_url: avatarUrl,
              }
            : comment.profile,
        };
      })
    );
  }, [user?.avatar_url, user?.id]);

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
      const fullName = profile?.full_name || "";

      return {
        ...comment,
        author_name: comment.is_anonymous ? "Masked" : fullName,
        author_avatar: comment.is_anonymous ? maskedAvatarPath : profile?.avatar_url || null,
        profile: comment.is_anonymous
          ? null
          : {
              id: profile?.id || comment.user_id,
              full_name: fullName,
              avatar_url: profile?.avatar_url || null,
            },
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

    if (typeof onCommentCreated === "function") {
      onCommentCreated(id);
    }

    await loadComments();

    return true;
  }

  async function handleDeletePost() {
    if (!canDelete || deleting || typeof onDeletePost !== "function") {
      return;
    }

    setDeleting(true);
    const success = await onDeletePost(id, imageUrl);
    setDeleting(false);

    if (success === false) {
      console.error("Post delete failed.");
    }
  }

  return (
    <article
      className={`rounded-2xl border p-6 ${
        isDark ? "border-slate-800 bg-slate-900 shadow-xl" : "border-slate-200 bg-white shadow-sm"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {(() => {
            const displayName = profile?.full_name || authorName || "";
            const displayAvatar = profile?.avatar_url ?? authorAvatar ?? null;
            const initial = (displayName?.charAt(0) || "").toUpperCase();
            const profilePath = !isAnonymous && authorUserId ? `/profile/${authorUserId}` : null;

            if (isAnonymous) {
              return (
                <img
                  src={maskedAvatarPath}
                  alt="Masked"
                  className="h-10 w-10 rounded-full object-cover"
                />
              );
            }

            if (displayAvatar) {
              const avatar = (
                <img
                  src={displayAvatar}
                  alt={displayName || "Profile avatar"}
                  className="h-10 w-10 rounded-full object-cover"
                />
              );

              return profilePath ? (
                <Link to={profilePath} aria-label={`Open ${displayName || "user"} profile`} className="shrink-0">
                  {avatar}
                </Link>
              ) : (
                avatar
              );
            }

            const avatarFallback = (
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${
                  isDark ? "bg-slate-700 text-white" : "bg-slate-200 text-slate-700"
                }`}
              >
                {initial}
              </div>
            );

            return profilePath ? (
              <Link to={profilePath} aria-label={`Open ${displayName || "user"} profile`} className="shrink-0">
                {avatarFallback}
              </Link>
            ) : (
              avatarFallback
            );
          })()}

          {isAnonymous || !authorUserId ? (
            <p className={`truncate text-sm font-medium ${isDark ? "text-slate-200" : "text-slate-900"}`}>
              {isAnonymous ? "Masked" : profile?.full_name || authorName}
            </p>
          ) : (
            <Link
              to={`/profile/${authorUserId}`}
              className={`truncate text-sm font-medium transition ${
                isDark ? "text-slate-200 hover:text-sky-300" : "text-slate-900 hover:text-[#c446ff]"
              }`}
            >
              {profile?.full_name || authorName}
            </Link>
          )}
        </div>

        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs ${
            isDark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"
          }`}
        >
          {date}
        </span>
      </div>

      {body ? (
        <p className={`mt-4 whitespace-pre-wrap ${isDark ? "text-slate-300" : "text-slate-700"}`}>
          {body}
        </p>
      ) : null}

      {imageUrl ? (
        <div className="mt-4 overflow-hidden rounded-2xl">
          <img
            src={imageUrl}
            alt="Post attachment"
            loading="lazy"
            className="max-h-[520px] w-full object-contain"
          />
        </div>
      ) : null}

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

        {canDelete ? (
          <button
            type="button"
            onClick={handleDeletePost}
            disabled={deleting}
            className={`ml-auto rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-70 ${
              isDark
                ? "bg-slate-800 text-rose-200 hover:bg-rose-950"
                : "bg-rose-50 text-rose-700 hover:bg-rose-100"
            }`}
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        ) : null}
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
