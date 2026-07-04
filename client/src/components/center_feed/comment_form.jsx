import { useEffect, useRef, useState } from "react";
import { useTheme } from "../../context/theme_context";
import { useAuth } from "../../context/auth_context";

function findMentionToken(value, cursorPosition) {
  const beforeCursor = value.slice(0, cursorPosition);
  const match = beforeCursor.match(/(^|\s)@([\w\s.-]*)$/);

  if (!match) {
    return null;
  }

  const token = match[0];
  const atOffset = token.lastIndexOf("@");
  const start = beforeCursor.length - token.length + atOffset;

  return {
    start,
    end: cursorPosition,
    query: match[2].trim().toLowerCase(),
  };
}

function getMentionPopupLeft(input, value, mentionToken) {
  if (!input || !mentionToken) {
    return 0;
  }

  const computedStyle = window.getComputedStyle(input);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    return 0;
  }

  context.font = computedStyle.font;

  const inputPadding = parseFloat(computedStyle.paddingLeft) || 0;
  const textBeforeMention = value.slice(0, mentionToken.start);
  const measuredLeft = inputPadding + context.measureText(textBeforeMention).width - input.scrollLeft;
  const maxLeft = Math.max(0, input.clientWidth - 224);

  return Math.min(Math.max(0, measuredLeft), maxLeft);
}

function CommentForm({ onSubmit, initialContent = "", placeholder = "Write a comment...", mentionUsers = [], onCancel }) {
  const [content, setContent] = useState(initialContent);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [mentionToken, setMentionToken] = useState(null);
  const [mentionPopupLeft, setMentionPopupLeft] = useState(0);
  const inputRef = useRef(null);
  const { isDark } = useTheme();
  const { user } = useAuth();
  const displayName = user?.full_name || user?.name || "Administrator";
  const initial = (displayName?.charAt(0) || "A").toUpperCase();
  const filteredMentionUsers = mentionToken
    ? mentionUsers
        .filter((mentionUser) => {
          const name = mentionUser?.full_name || "";
          return name.toLowerCase().includes(mentionToken.query);
        })
        .slice(0, 6)
    : [];

  useEffect(() => {
    setContent(initialContent);

    if (!initialContent) return;

    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(initialContent.length, initialContent.length);
    });
  }, [initialContent]);

  function handleContentChange(event) {
    const nextContent = event.target.value;
    const cursorPosition = event.target.selectionStart || nextContent.length;
    const nextMentionToken = findMentionToken(nextContent, cursorPosition);

    setContent(nextContent);
    setMentionToken(nextMentionToken);
    setMentionPopupLeft(getMentionPopupLeft(event.target, nextContent, nextMentionToken));
  }

  function updateMentionTokenFromInput(input) {
    const nextMentionToken = findMentionToken(input.value, input.selectionStart || input.value.length);

    setMentionToken(nextMentionToken);
    setMentionPopupLeft(getMentionPopupLeft(input, input.value, nextMentionToken));
  }

  function handleMentionSelect(mentionUser) {
    if (!mentionToken) return;

    const mentionName = mentionUser?.full_name || "";
    const nextContent = `${content.slice(0, mentionToken.start)}@${mentionName} ${content.slice(mentionToken.end)}`;
    const nextCursorPosition = mentionToken.start + mentionName.length + 2;

    setContent(nextContent);
    setMentionToken(null);

    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(nextCursorPosition, nextCursorPosition);
    });
  }

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
    setMentionToken(null);
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

        <div className="relative min-w-0 flex-1">
          {filteredMentionUsers.length ? (
            <div
              style={{ left: mentionPopupLeft }}
              className={`absolute bottom-12 z-20 w-56 max-w-full overflow-hidden rounded-2xl border py-1 shadow-2xl ${
                isDark ? "border-slate-800 bg-slate-950 text-slate-100" : "border-slate-200 bg-white text-slate-900"
              }`}
            >
              {filteredMentionUsers.map((mentionUser) => (
                <button
                  key={mentionUser.id}
                  type="button"
                  onClick={() => handleMentionSelect(mentionUser)}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm font-medium transition ${
                    isDark ? "hover:bg-slate-900" : "hover:bg-slate-50"
                  }`}
                >
                  {mentionUser.avatar_url ? (
                    <img
                      src={mentionUser.avatar_url}
                      alt={mentionUser.full_name}
                      className="h-7 w-7 rounded-full object-cover"
                    />
                  ) : (
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                        isDark ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {(mentionUser.full_name?.charAt(0) || "U").toUpperCase()}
                    </span>
                  )}
                  <span className="truncate">{mentionUser.full_name}</span>
                </button>
              ))}
            </div>
          ) : null}
          <input
            ref={inputRef}
            value={content}
            onChange={handleContentChange}
            onKeyUp={(event) => updateMentionTokenFromInput(event.currentTarget)}
            onClick={(event) => updateMentionTokenFromInput(event.currentTarget)}
            type="text"
            placeholder={placeholder}
            className={`h-11 w-full rounded-full border px-4 text-sm outline-none transition ${
              isDark
                ? "border-slate-800 bg-slate-900 text-slate-100 focus:border-sky-500"
                : "border-slate-300 bg-slate-50 text-slate-800 focus:border-[#c446ff] focus:bg-white"
            }`}
          />
        </div>

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

        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel reply"
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition ${
              isDark ? "bg-slate-900 text-slate-300 hover:bg-slate-800" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            ×
          </button>
        ) : null}
      </div>
      {error && <p className={`ml-12 text-sm ${isDark ? "text-rose-400" : "text-rose-600"}`}>{error}</p>}
    </form>
  );
}

export default CommentForm;
