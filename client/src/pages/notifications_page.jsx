import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/auth_context";
import { useTheme } from "../context/theme_context";
import ChatWidget from "../components/chat/chat_widget";
import {
  getMyNotificationsResult,
  markNotificationRead,
} from "../services/notifications_service";
import { getProfilePath } from "../utils/profile_path";

function getInitials(name, email) {
  const source = name || email || "User";
  return (
    source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  );
}

function formatNotificationTime(value) {
  if (!value) {
    return "Unknown";
  }

  return new Date(value).toLocaleString();
}

function NotificationsPage() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [isMobileChatView, setIsMobileChatView] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false
  );
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [markingById, setMarkingById] = useState({});

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data, error: fetchError } = await getMyNotificationsResult();

    if (fetchError) {
      setNotifications([]);
      setError("Unable to load notifications right now. Please try again.");
      setLoading(false);
      return;
    }

    setNotifications(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const updateMobileView = () => {
      setIsMobileChatView(mediaQuery.matches);
    };

    updateMobileView();
    mediaQuery.addEventListener("change", updateMobileView);

    return () => {
      mediaQuery.removeEventListener("change", updateMobileView);
    };
  }, []);

  useEffect(() => {
    if (!isMobileChatView) {
      loadNotifications();
    }
  }, [isMobileChatView, loadNotifications]);

  const handleMarkRead = async (id) => {
    if (!id) {
      return;
    }

    setMarkingById((current) => ({
      ...current,
      [id]: true,
    }));

    const { data, error: markError } = await markNotificationRead(id);

    if (!markError && data) {
      setNotifications((current) =>
        current.map((item) => (item.id === id ? { ...item, is_read: true, ...data } : item))
      );
    }

    setMarkingById((current) => ({
      ...current,
      [id]: false,
    }));
  };

  if (isMobileChatView) {
    return (
      <div className={`fixed inset-0 z-[70] h-[100dvh] ${isDark ? "bg-slate-950" : "bg-[#f0f2f5]"}`}>
        <ChatWidget fullScreen />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <div
        className={`rounded-2xl border p-4 sm:p-6 ${
          isDark ? "border-slate-800 bg-slate-900 shadow-xl" : "border-slate-200 bg-white shadow-sm"
        }`}
      >
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500 sm:text-sm sm:tracking-[0.28em]">Notifications</p>
          <h2 className={`mt-2 text-xl font-semibold sm:text-2xl ${isDark ? "text-slate-100" : "text-slate-900"}`}>
            What’s happening today
          </h2>
        </div>
      </div>

      {loading ? (
        <div
          className={`rounded-2xl border p-4 text-sm sm:p-6 ${
            isDark ? "border-slate-800 bg-slate-950 text-slate-300" : "border-slate-200 bg-white text-slate-600"
          }`}
        >
          Loading notifications...
        </div>
      ) : null}

      {!loading && error ? (
        <div
          className={`rounded-2xl border p-4 sm:p-6 ${
            isDark ? "border-rose-900 bg-rose-950/30 text-rose-200" : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          <p className="text-sm font-medium">{error}</p>
          <button
            type="button"
            onClick={loadNotifications}
            className={`mt-4 rounded-full border px-4 py-2 text-sm font-medium transition ${
              isDark
                ? "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
            }`}
          >
            Retry
          </button>
        </div>
      ) : null}

      {!loading && !error && notifications.length === 0 ? (
        <div
          className={`rounded-2xl border p-4 text-sm sm:p-6 ${
            isDark ? "border-slate-800 bg-slate-950 text-slate-300" : "border-slate-200 bg-white text-slate-600"
          }`}
        >
          No notifications yet.
        </div>
      ) : null}

      {!loading && !error && notifications.length > 0 ? (
        <div className="space-y-4">
          {notifications.map((item) => {
            const actor = item.actor || null;
            const actorName = actor?.full_name || actor?.email || "";

            return (
          <div
            key={item.id}
            className={`rounded-2xl border p-4 shadow-sm sm:p-5 ${
              isDark
                ? "border-slate-800 bg-slate-950 text-slate-200 shadow-slate-950/20"
                : "border-slate-200 bg-white text-slate-700"
            }`}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="flex min-w-0 items-start gap-3">
                {actor?.id ? (
                  <Link
                    to={getProfilePath(actor.id, user?.id)}
                    aria-label={`Open ${actorName || "user"} profile`}
                    className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-[#f6e8ff] text-sm font-bold text-[#c446ff]"
                  >
                    {actor.avatar_url ? (
                      <img src={actor.avatar_url} alt={actorName} className="h-full w-full object-cover" />
                    ) : (
                      getInitials(actor.full_name, actor.email)
                    )}
                  </Link>
                ) : null}
                <div className="min-w-0">
                  <h3 className={`text-lg font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                    {item.title || "Notification"}
                  </h3>
                  {actor?.id ? (
                    <Link
                      to={getProfilePath(actor.id, user?.id)}
                      className={`mt-1 block cursor-pointer truncate text-sm font-semibold transition ${
                        isDark ? "text-slate-300 hover:text-sky-300" : "text-slate-700 hover:text-[#c446ff]"
                      }`}
                    >
                      {actorName}
                    </Link>
                  ) : null}
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                  {(item.type || "general").toString().replaceAll("_", " ")}
                </p>
                </div>
              </div>
              <span className="break-words text-xs uppercase tracking-[0.18em] text-slate-500 sm:tracking-[0.24em]">
                {formatNotificationTime(item.created_at)}
              </span>
            </div>
            <p className={`mt-3 text-sm leading-6 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              {item.body || "No details provided."}
            </p>

            <div className="mt-4 flex flex-col gap-3 min-[360px]:flex-row min-[360px]:items-center min-[360px]:justify-between">
              <span
                className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.2em] ${
                  item.is_read
                    ? isDark
                      ? "border-slate-700 bg-slate-900 text-slate-300"
                      : "border-slate-200 bg-slate-100 text-slate-600"
                    : isDark
                      ? "border-sky-900 bg-sky-950/40 text-sky-200"
                      : "border-sky-200 bg-sky-50 text-sky-700"
                }`}
              >
                {item.is_read ? "Read" : "Unread"}
              </span>

              {!item.is_read ? (
                <button
                  type="button"
                  onClick={() => handleMarkRead(item.id)}
                  disabled={Boolean(markingById[item.id])}
                  className={`rounded-full border px-4 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-70 ${
                    isDark
                      ? "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {markingById[item.id] ? "Marking..." : "Mark as read"}
                </button>
              ) : null}
            </div>
          </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default NotificationsPage;
