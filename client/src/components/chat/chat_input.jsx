import { useTheme } from "../../context/theme_context";

function ChatInput({ value, onChange, onSend }) {
  const { isDark } = useTheme();

  return (
    <div
      className={`mt-5 flex min-w-0 flex-col gap-3 rounded-2xl border p-3 sm:flex-row sm:items-center ${
        isDark
          ? "border-slate-800 bg-slate-950 shadow-lg shadow-slate-950/10"
          : "border-slate-200 bg-slate-50 shadow-sm"
      }`}
    >
      <input
        value={value}
        onChange={onChange}
        placeholder="Send a team message"
        className={`min-w-0 flex-1 rounded-2xl border px-4 py-3 text-sm outline-none transition ${
          isDark
            ? "border-slate-800 bg-slate-900 text-slate-100 focus:border-sky-500"
            : "border-slate-300 bg-white text-slate-800 focus:border-[#c446ff]"
        }`}
      />
      <button
        onClick={onSend}
        className={`shrink-0 rounded-full px-5 py-3 text-sm font-semibold transition sm:self-stretch ${
          isDark
            ? "bg-sky-500 text-slate-950 hover:bg-sky-400"
            : "bg-[#c446ff] text-white hover:bg-[#ad32e3]"
        }`}
      >
        Send
      </button>
    </div>
  );
}

export default ChatInput;
