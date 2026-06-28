import ChatHeader from "./chat_header";
import MessageBubble from "./message_bubble";
import ChatInput from "./chat_input";

function ChatPanel({
  messages = [],
  draft = "",
  onDraftChange = () => {},
  onSend = () => {},
}) {
  return (
    <div className="flex h-full flex-col">
      <ChatHeader title="Team chat" status="Live channel" />

      <div className="flex-1 space-y-4 overflow-auto pr-1 pb-3">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            author={message.author}
            content={message.content}
            time={message.time}
            isOwn={message.isOwn}
          />
        ))}
      </div>

      <ChatInput
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        onSend={onSend}
      />
    </div>
  );
}

export default ChatPanel;