import { useTheme } from "../../context/theme_context";

function MessageBubble({ author, content, time, isOwn }) {
  const { isDark } = useTheme();

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
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
        <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
          <span>{author}</span>
          <span>{time}</span>
        </div>
        <p className="mt-2">{content}</p>
      </div>
    </div>
  );
}

export default MessageBubble;
