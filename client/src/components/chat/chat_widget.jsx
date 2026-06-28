import ChatPanel from "./chat_panel";
import ChatSidebar from "./chat_sidebar";
import { useTheme } from "../../context/theme_context";

function ChatWidget({ messages, draft, onDraftChange, onSend }) {
  const { isDark } = useTheme();

  return (
    <div className="flex h-full flex-col gap-5">
      <div
        className={`flex h-full flex-col rounded-2xl border p-4 ${
          isDark ? "border-slate-800 bg-slate-950 shadow-2xl shadow-slate-950/30" : "border-slate-200 bg-white shadow-sm"
        }`}
      >
        <ChatPanel messages={messages} draft={draft} onDraftChange={onDraftChange} onSend={onSend} />
      </div>
      <ChatSidebar />
    </div>
  );
}

export default ChatWidget;
