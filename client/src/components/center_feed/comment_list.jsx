import { Link } from "react-router-dom";
import { useTheme } from "../../context/theme_context";

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

function CommentList({ comments, loading }) {
  const { isDark } = useTheme();

  if (loading) {
    return <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>Loading comments...</p>;
  }

  if (!comments.length) {
    return (
      <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
        No comments yet. Be the first to reply.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {comments.map((comment) => {
        const isAnonymousComment = Boolean(comment.is_anonymous);
        const profile = comment.profile || null;
        const fullName = isAnonymousComment ? "Masked" : profile?.full_name || comment.author_name || "";
        const avatarSrc = isAnonymousComment
          ? "/masked-avatar.jpg"
          : profile?.avatar_url ?? comment.author_avatar ?? null;
        const initials = (fullName.charAt(0) || "").toUpperCase();
        const profilePath = !isAnonymousComment && comment.user_id ? `/profile/${comment.user_id}` : null;

        return (
          <div
            key={comment.id}
            className={`rounded-2xl border p-4 shadow-sm ${
              isDark
                ? "border-slate-800 bg-slate-900 text-slate-200 shadow-slate-950/10"
                : "border-slate-200 bg-white text-slate-700"
            }`}
          >
            <div className="flex items-start gap-3">
              {avatarSrc ? (
                profilePath ? (
                  <Link to={profilePath} aria-label={`Open ${fullName || "user"} profile`} className="shrink-0">
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
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
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
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  {profilePath ? (
                    <Link
                      to={profilePath}
                      className={`font-medium transition ${isDark ? "text-slate-300 hover:text-sky-300" : "text-slate-800 hover:text-[#c446ff]"}`}
                    >
                      {fullName}
                    </Link>
                  ) : (
                    <span className={`font-medium ${isDark ? "text-slate-300" : "text-slate-800"}`}>{fullName}</span>
                  )}
                  <span>{formatRelativeTime(comment.created_at)}</span>
                </div>
                <p className={`mt-2 text-sm leading-6 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  {comment.content}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default CommentList;
