import { useEffect, useRef } from "react";
import ChatHeader from "./chat_header";
import MessageBubble from "./message_bubble";
import ChatInput from "./chat_input";

function ChatPanel({
  fullScreen = false,
  messages = [],
  draft = "",
  error = "",
  loading = false,
  sending = false,
  isOnline = false,
  onDraftChange = () => {},
  onSend = () => {},
}) {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ChatHeader isOnline={isOnline} showBackButton={fullScreen} />

      <div className="min-h-0 flex-1 space-y-4 overflow-auto pb-3 pr-1">
        {loading ? (
          <p className="px-2 py-4 text-center text-sm text-slate-500">Loading team messages...</p>
        ) : null}

        {!loading && messages.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-slate-500">No messages yet.</p>
        ) : null}

        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            author={message.author}
            avatar={message.author_avatar}
            profilePath={message.profilePath}
            department={message.department}
            content={message.content}
            time={message.time}
            isOwn={message.isOwn}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {error ? (
        <p className="mt-3 rounded-2xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
          {error}
        </p>
      ) : null}

      <ChatInput
        value={draft}
        disabled={sending}
        onChange={(event) => onDraftChange(event.target.value)}
        onSend={onSend}
      />
    </div>
  );
}

export default ChatPanel;
