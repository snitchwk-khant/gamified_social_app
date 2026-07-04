import { Link } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../../context/auth_context";
import { useTheme } from "../../context/theme_context";
import { getProfilePath } from "../../utils/profile_path";

function formatRelativeTime(dateString) {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return `${diffWeeks}w ago`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;

  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears}y ago`;
}

function CommentList({ comments, loading, onDeleteComment }) {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [activeMenuCommentId, setActiveMenuCommentId] = useState("");
  const [confirmDeleteComment, setConfirmDeleteComment] = useState(null);
  const [deletingCommentId, setDeletingCommentId] = useState("");
  const [deleteError, setDeleteError] = useState("");

  if (loading) {
    return <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>Loading comments...</p>;
  }

  if (!comments.length) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center text-center">
        <p className={`text-base font-semibold ${isDark ? "text-slate-200" : "text-slate-800"}`}>
          No comments yet.
        </p>
        <p className={`mt-1 text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          Start the conversation.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {comments.map((comment) => {
        const isAnonymousComment = Boolean(comment.is_anonymous);
        const profile = comment.profile || null;
        const fullName = isAnonymousComment ? "Masked" : profile?.full_name || comment.author_name || "";
        const avatarSrc = isAnonymousComment
          ? "/masked-avatar.jpg"
          : profile?.avatar_url ?? comment.author_avatar ?? null;
        const initials = (fullName.charAt(0) || "").toUpperCase();
        const profilePath = !isAnonymousComment && comment.user_id ? getProfilePath(comment.user_id, user?.id) : null;
        const isOwner = Boolean(user?.id && comment.user_id === user.id);
        const menuOpen = activeMenuCommentId === comment.id;

        return (
          <div
            key={comment.id}
            className="flex items-start gap-3"
          >
            {avatarSrc ? (
              profilePath ? (
                <Link to={profilePath} aria-label={`Open ${fullName || "user"} profile`} className="shrink-0 cursor-pointer">
                  <img
                    src={avatarSrc}
                    alt={fullName}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                </Link>
              ) : (
                <img
                  src={avatarSrc}
                  alt={fullName}
                  className="h-10 w-10 rounded-full object-cover"
                />
              )
            ) : profilePath ? (
              <Link
                to={profilePath}
                aria-label={`Open ${fullName || "user"} profile`}
                className={`flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-sm font-semibold ${
                  isDark ? "bg-slate-700 text-white" : "bg-slate-200 text-slate-700"
                }`}
              >
                {initials}
              </Link>
            ) : (
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${
                  isDark ? "bg-slate-700 text-white" : "bg-slate-200 text-slate-700"
                }`}
              >
                {initials}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <div className="flex min-w-0 items-center gap-2">
                  {profilePath ? (
                    <Link
                      to={profilePath}
                      className={`truncate text-sm font-semibold transition ${isDark ? "text-slate-100 hover:text-sky-300" : "text-slate-900 hover:text-[#c446ff]"}`}
                    >
                      {fullName}
                    </Link>
                  ) : (
                    <span className={`truncate text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>{fullName}</span>
                  )}
                </div>
                <span className={`text-xs ${isDark ? "text-slate-500" : "text-slate-500"}`}>{formatRelativeTime(comment.created_at)}</span>
                </div>
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError("");
                      setActiveMenuCommentId(menuOpen ? "" : comment.id);
                    }}
                    aria-label="Comment options"
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-lg transition ${
                      isDark ? "text-slate-400 hover:bg-slate-900 hover:text-slate-100" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    ⋯
                  </button>

                  {menuOpen ? (
                    <div
                      className={`absolute right-0 top-9 z-10 w-36 overflow-hidden rounded-2xl border py-1 shadow-xl ${
                        isDark ? "border-slate-800 bg-slate-950 text-slate-100" : "border-slate-200 bg-white text-slate-900"
                      }`}
                    >
                      {isOwner ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setActiveMenuCommentId("")}
                            className={`block w-full px-4 py-2.5 text-left text-sm font-medium transition ${
                              isDark ? "hover:bg-slate-900" : "hover:bg-slate-50"
                            }`}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDeleteComment(comment);
                              setActiveMenuCommentId("");
                            }}
                            className={`block w-full px-4 py-2.5 text-left text-sm font-medium text-rose-500 transition ${
                              isDark ? "hover:bg-slate-900" : "hover:bg-rose-50"
                            }`}
                          >
                            Delete
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setActiveMenuCommentId("")}
                            className={`block w-full px-4 py-2.5 text-left text-sm font-medium transition ${
                              isDark ? "hover:bg-slate-900" : "hover:bg-slate-50"
                            }`}
                          >
                            Report
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveMenuCommentId("")}
                            className={`block w-full px-4 py-2.5 text-left text-sm font-medium transition ${
                              isDark ? "hover:bg-slate-900" : "hover:bg-slate-50"
                            }`}
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className={`mt-1 rounded-2xl px-4 py-3 ${
                isDark ? "bg-slate-900 text-slate-200" : "bg-slate-100 text-slate-700"
              }`}>
                <p className="text-sm leading-6">
                  {comment.content}
                </p>
              </div>
            </div>
          </div>
        );
      })}

      {confirmDeleteComment ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
          <div
            className={`w-full max-w-sm rounded-3xl border p-5 shadow-2xl ${
              isDark ? "border-slate-800 bg-slate-950 text-slate-100" : "border-slate-200 bg-white text-slate-950"
            }`}
          >
            <h3 className="text-lg font-semibold">Delete Comment?</h3>
            <p className={`mt-2 text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              This action cannot be undone.
            </p>
            {deleteError ? (
              <p className={`mt-3 text-sm ${isDark ? "text-rose-300" : "text-rose-600"}`}>{deleteError}</p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmDeleteComment(null);
                  setDeleteError("");
                }}
                disabled={Boolean(deletingCommentId)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${
                  isDark ? "bg-slate-900 text-slate-200 hover:bg-slate-800" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (typeof onDeleteComment !== "function") {
                    return;
                  }

                  setDeletingCommentId(confirmDeleteComment.id);
                  setDeleteError("");

                  const success = await onDeleteComment(confirmDeleteComment.id);
                  setDeletingCommentId("");

                  if (!success) {
                    setDeleteError("Unable to delete comment. Please try again.");
                    return;
                  }

                  setConfirmDeleteComment(null);
                }}
                disabled={Boolean(deletingCommentId)}
                className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {deletingCommentId ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default CommentList;
