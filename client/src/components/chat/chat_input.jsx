import { useTheme } from "../../context/theme_context";

const MAX_MESSAGE_LENGTH = 1000;

function ChatInput({ value, disabled = false, onChange, onSend }) {
  const { isDark } = useTheme();

  const handleKeyDown = (event) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    onSend();
  };

  return (
    <div
      className={`mt-5 flex min-w-0 flex-col gap-3 rounded-2xl border p-3 sm:flex-row sm:items-center ${
        isDark
          ? "border-slate-800 bg-slate-950 shadow-lg shadow-slate-950/10"
          : "border-slate-200 bg-slate-50 shadow-sm"
      }`}
    >
      <textarea
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        maxLength={MAX_MESSAGE_LENGTH}
        rows={2}
        disabled={disabled}
        placeholder="Send a team message"
        className={`max-h-36 min-w-0 flex-1 resize-none rounded-2xl border px-4 py-3 text-sm outline-none transition disabled:cursor-not-allowed disabled:opacity-70 ${
          isDark
            ? "border-slate-800 bg-slate-900 text-slate-100 focus:border-sky-500"
            : "border-slate-300 bg-white text-slate-800 focus:border-[#c446ff]"
        }`}
      />
      <button
        type="button"
        onClick={onSend}
        disabled={disabled || !value.trim()}
        className={`shrink-0 rounded-full px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 sm:self-stretch ${
          isDark
            ? "bg-sky-500 text-slate-950 hover:bg-sky-400"
            : "bg-[#c446ff] text-white hover:bg-[#ad32e3]"
        }`}
      >
        {disabled ? "Sending..." : "Send"}
      </button>
    </div>
  );
}

export default ChatInput;
