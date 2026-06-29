import { useCallback, useEffect, useState } from "react";
import ChatPanel from "./chat_panel";
import { useTheme } from "../../context/theme_context";
import {
  getTeamMessageById,
  getTeamMessages,
  sendTeamMessage,
  subscribeToTeamMessages,
} from "../../services/messages_service";

function ChatWidget({ fullScreen = false }) {
  const { isDark } = useTheme();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [isOnline, setIsOnline] = useState(false);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data, error: loadError } = await getTeamMessages();

    if (loadError) {
      setMessages([]);
      setError(loadError?.message || "Unable to load team chat.");
    } else {
      setMessages(data || []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadMessages();

    const unsubscribe = subscribeToTeamMessages(
      (payload) => {
        const messageId = payload?.new?.id;

        if (!messageId) {
          return;
        }

        getTeamMessageById(messageId).then(({ data, error: formatError }) => {
          if (formatError || !data) {
            if (formatError) {
              console.error("Team message realtime format error:", formatError);
            }
            return;
          }

          setMessages((currentMessages) => {
            if (currentMessages.some((message) => message.id === data.id)) {
              return currentMessages;
            }

            return [...currentMessages, data].sort(
              (leftMessage, rightMessage) =>
                new Date(leftMessage.created_at).getTime() - new Date(rightMessage.created_at).getTime()
            );
          });
        });
      },
      (status) => {
        setIsOnline(status === "SUBSCRIBED");
      }
    );

    return () => {
      unsubscribe();
    };
  }, [loadMessages]);

  const handleSend = async () => {
    const trimmedDraft = draft.trim();

    if (!trimmedDraft || sending) {
      return;
    }

    setSending(true);
    setError("");

    const { data, error: sendError } = await sendTeamMessage(trimmedDraft);

    if (sendError) {
      setError(sendError?.message || "Unable to send message.");
      setSending(false);
      return;
    }

    setDraft("");

    if (data) {
      setMessages((currentMessages) => {
        if (currentMessages.some((message) => message.id === data.id)) {
          return currentMessages;
        }

        return [...currentMessages, data];
      });
    }

    setSending(false);
  };

  return (
    <div className={fullScreen ? "flex h-full min-h-0 flex-col" : "flex h-[calc(100vh-7rem)] min-h-[520px] flex-col gap-5 xl:h-full xl:min-h-0"}>
      <div
        className={`flex h-full min-h-0 flex-col ${
          fullScreen ? "border-0 p-3" : "rounded-2xl border p-3 sm:p-4"
        } ${
          isDark
            ? fullScreen
              ? "bg-slate-950"
              : "border-slate-800 bg-slate-950 shadow-2xl shadow-slate-950/30"
            : fullScreen
              ? "bg-[#f0f2f5]"
              : "border-slate-200 bg-white shadow-sm"
        }`}
      >
        <ChatPanel
          fullScreen={fullScreen}
          messages={messages}
          draft={draft}
          error={error}
          loading={loading}
          sending={sending}
          isOnline={isOnline}
          onDraftChange={setDraft}
          onSend={handleSend}
        />
      </div>
    </div>
  );
}

export default ChatWidget;
