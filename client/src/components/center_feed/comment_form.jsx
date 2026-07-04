import { useState } from "react";
import { useTheme } from "../../context/theme_context";
import { useAuth } from "../../context/auth_context";

function CommentForm({ onSubmit }) {
  const [content, setContent] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { isDark } = useTheme();
  const { user } = useAuth();
  const displayName = user?.full_name || user?.name || "Administrator";
  const initial = (displayName?.charAt(0) || "A").toUpperCase();

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!content.trim()) {
      setError("Comment cannot be empty");
      return;
    }

    setSubmitting(true);
    setError("");

    const success = await onSubmit(content.trim(), isAnonymous);
    setSubmitting(false);

    if (!success) {
      setError("Something went wrong. Please try again.");
      return;
    }

    setContent("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIsAnonymous((current) => !current)}
          aria-label={isAnonymous ? "Comment as yourself" : "Comment anonymously"}
          title={isAnonymous ? "Comment as Masked" : "Comment as yourself"}
          className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full transition ${
            isDark ? "bg-slate-900" : "bg-slate-100"
          }`}
        >
          {isAnonymous ? (
            <img
              src="/masked-avatar.png"
              alt="Masked"
              className="h-full w-full object-cover"
            />
          ) : user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={displayName}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className={`text-xs font-semibold ${isDark ? "text-slate-100" : "text-slate-700"}`}>
              {initial}
            </span>
          )}
        </button>

        <input
          value={content}
          onChange={(event) => setContent(event.target.value)}
          type="text"
          placeholder="Write a comment..."
          className={`h-11 min-w-0 flex-1 rounded-full border px-4 text-sm outline-none transition ${
            isDark
              ? "border-slate-800 bg-slate-900 text-slate-100 focus:border-sky-500"
              : "border-slate-300 bg-slate-50 text-slate-800 focus:border-[#c446ff] focus:bg-white"
          }`}
        />

        <button
          type="submit"
          disabled={submitting}
          aria-label="Send comment"
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-semibold transition ${
            submitting
              ? `cursor-not-allowed ${isDark ? "bg-slate-700 text-slate-300" : "bg-slate-400 text-white"}`
              : isDark
                ? "bg-sky-500 text-slate-950 hover:bg-sky-400"
                : "bg-[#c446ff] text-white hover:bg-[#ad32e3]"
          }`}
        >
          {submitting ? "..." : "➤"}
        </button>
      </div>
      {error && <p className={`ml-12 text-sm ${isDark ? "text-rose-400" : "text-rose-600"}`}>{error}</p>}
    </form>
  );
}

export default CommentForm;
