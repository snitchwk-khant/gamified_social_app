import { useTheme } from "../../context/theme_context";
import { Link } from "react-router-dom";

function getInitials(name) {
  const parts = name
    ?.split(/\s+/)
    .filter(Boolean)
    .slice(0, 2) || [];

  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "T";
}

function ChatAvatar({ author, avatar, profilePath, isOwn }) {
  const { isDark } = useTheme();

  const avatarContent = avatar ? (
    <img src={avatar} alt={author || "Team member"} className="h-full w-full object-cover" />
  ) : (
    <span
      className={`text-xs font-semibold ${
        isOwn ? (isDark ? "text-sky-200" : "text-[#8f26c7]") : isDark ? "text-slate-100" : "text-slate-700"
      }`}
    >
      {getInitials(author)}
    </span>
  );

  return (
    <Link
      to={profilePath || "/profile"}
      aria-label={`Open ${author || "team member"} profile`}
      className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border transition hover:scale-105 hover:ring-2 hover:ring-[#c446ff]/60 focus:outline-none focus:ring-2 focus:ring-[#c446ff]/70 sm:h-10 sm:w-10 ${
        isOwn
          ? isDark
            ? "border-sky-500 bg-slate-950"
            : "border-[#e8c8ff] bg-[#f6e8ff]"
          : isDark
            ? "border-slate-700 bg-slate-950"
            : "border-slate-200 bg-slate-100"
      }`}
    >
      {avatarContent}
    </Link>
  );
}

function MessageBubble({ author, avatar, profilePath, department, content, time, isOwn }) {
  const { isDark } = useTheme();
  const hasDepartment = Boolean(department?.trim() && department !== "No department");

  return (
    <div className={`flex items-end gap-3 ${isOwn ? "justify-end" : "justify-start"}`}>
      {!isOwn ? (
        <ChatAvatar author={author} avatar={avatar} profilePath={profilePath} isOwn={isOwn} />
      ) : null}

      <div
        className={`max-w-[85%] rounded-2xl border px-4 py-3 text-sm leading-6 shadow-sm ${
          isOwn
            ? isDark
              ? "border-sky-600 bg-sky-500 text-slate-950"
              : "border-[#e8c8ff] bg-[#f6e8ff] text-[#8f26c7]"
            : isDark
              ? "border-slate-800 bg-slate-900 text-slate-200"
              : "border-slate-200 bg-white text-slate-700"
        }`}
      >
        <div
          className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs ${
            isOwn ? "text-slate-800/70" : isDark ? "text-slate-400" : "text-slate-500"
          }`}
        >
          <div className="min-w-0">
            <p className="truncate font-semibold">{author}</p>
            {hasDepartment ? <p className="truncate">{department}</p> : null}
          </div>
          <span className="shrink-0">{time}</span>
        </div>
        <p className="mt-2 whitespace-pre-wrap break-words">{content}</p>
      </div>

      {isOwn ? (
        <ChatAvatar author={author} avatar={avatar} profilePath={profilePath} isOwn={isOwn} />
      ) : null}
    </div>
  );
}

export default MessageBubble;
