import { useState } from "react";
import { useTheme } from "../../context/theme_context";
import { useAuth } from "../../context/auth_context";

function PostForm({ value, onChange, onSubmit }) {
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [error, setError] = useState("");
  const { isDark } = useTheme();
  const { user } = useAuth();

  const adminDisplayName = user?.full_name || user?.name || "Administrator";
  const adminInitial = (adminDisplayName?.charAt(0) || "A").toUpperCase();

  const handleSubmit = async () => {
    const trimmedValue = value?.trim();
    if (!trimmedValue) {
      setError("Post cannot be empty");
      return;
    }

    setError("");
    const success = await onSubmit(trimmedValue, isAnonymous);

    if (success === false) {
      setError("Something went wrong. Please try again.");
    }
  };

  return (
    <div
      className={`rounded-2xl border p-6 transition duration-300 ${
        isDark
          ? "border-slate-800 bg-slate-900 shadow-lg shadow-slate-950/10 hover:border-slate-700"
          : "border-slate-200 bg-white shadow-sm hover:border-slate-300"
      }`}
    >
      <textarea
        rows="4"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Share a story, milestone, or update with your team..."
        className={`w-full resize-none rounded-2xl border px-4 py-4 text-sm outline-none transition ${
          isDark
            ? "border-slate-800 bg-slate-950 text-slate-100 focus:border-sky-500"
            : "border-slate-300 bg-slate-50 text-slate-800 focus:border-[#c446ff] focus:bg-white"
        }`}
      />

      {error && (
        <p className={`mt-3 text-sm ${isDark ? "text-rose-400" : "text-rose-600"}`}>{error}</p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className={`flex flex-wrap items-center gap-4 text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}>
          <span className={`${isDark ? "text-slate-400" : "text-slate-500"}`}>Post as</span>

          <div className="flex flex-wrap items-center gap-2">
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
                  alt={adminDisplayName}
                  className="h-7 w-7 rounded-full object-cover"
                />
              ) : (
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                  isDark ? "bg-slate-700 text-slate-100" : "bg-slate-200 text-slate-700"
                }`}>
                  {adminInitial}
                </div>
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
                className="h-7 w-7 rounded-full object-cover"
              />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          className={`rounded-full px-5 py-3 text-sm font-semibold transition ${
            isDark
              ? "bg-sky-500 text-slate-950 hover:bg-sky-400"
              : "bg-[#c446ff] text-white hover:bg-[#ad32e3]"
          }`}
        >
          Publish
        </button>
      </div>
    </div>
  );
}

export default PostForm;
