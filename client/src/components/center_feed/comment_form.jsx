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
      className={`space-y-3 rounded-2xl border p-4 ${
        isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
      }`}
    >
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        rows="3"
        placeholder="Write a comment..."
        className={`w-full resize-none rounded-2xl border px-4 py-3 text-sm outline-none transition ${
          isDark
            ? "border-slate-800 bg-slate-950 text-slate-100 focus:border-sky-500"
            : "border-slate-300 bg-slate-50 text-slate-800 focus:border-[#c446ff] focus:bg-white"
        }`}
      />
      {error && <p className={`text-sm ${isDark ? "text-rose-400" : "text-rose-600"}`}>{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className={`flex flex-wrap items-center gap-4 text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}>
          <span className={`${isDark ? "text-slate-400" : "text-slate-500"}`}>Post as</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAnonymous(false)}
              aria-pressed={!isAnonymous}
              aria-label="Post as yourself"
              title="Post as yourself"
              className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border transition ${
                !isAnonymous
                  ? isDark
                    ? "border-sky-500 bg-slate-800"
                    : "border-[#c446ff] bg-[#f6e8ff]"
                  : isDark
                    ? "border-slate-700 bg-slate-950 hover:bg-slate-900"
                    : "border-slate-300 bg-white hover:bg-slate-50"
              }`}
            >
              {user?.avatar_url ? (
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

            <button
              type="button"
              onClick={() => setIsAnonymous(true)}
              aria-pressed={isAnonymous}
              aria-label="Post as Masked"
              title="Post as Masked"
              className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border transition ${
                isAnonymous
                  ? isDark
                    ? "border-sky-500 bg-slate-800"
                    : "border-[#c446ff] bg-[#f6e8ff]"
                  : isDark
                    ? "border-slate-700 bg-slate-950 hover:bg-slate-900"
                    : "border-slate-300 bg-white hover:bg-slate-50"
              }`}
            >
              <img
                src="/masked-avatar.png"
                alt="Masked"
                className="h-full w-full object-cover"
              />
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className={`rounded-full px-4 py-3 text-sm font-semibold transition ${
            submitting
              ? `cursor-not-allowed ${isDark ? "bg-slate-700 text-slate-300" : "bg-slate-400 text-white"}`
              : isDark
                ? "bg-sky-500 text-slate-950 hover:bg-sky-400"
                : "bg-[#c446ff] text-white hover:bg-[#ad32e3]"
          }`}
        >
          {submitting ? "Posting..." : "Comment"}
        </button>
      </div>
    </form>
  );
}

export default CommentForm;
