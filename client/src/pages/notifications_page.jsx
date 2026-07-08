import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/theme_context";
import {
  getMyNotificationsResult,
  getNotificationActionUrl,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToMyNotifications,
  subscribeToUnreadNotificationCount,
} from "../services/notifications_service";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
];

const CATEGORY_STYLES = {
  Announcement: { icon: "📢", label: "Announcement" },
  Achievement: { icon: "🏆", label: "Achievement" },
  Reward: { icon: "🎁", label: "Reward" },
  System: { icon: "⚙️", label: "System" },
  Social: { icon: "💬", label: "Social" },
  Warning: { icon: "⚠️", label: "Warning" },
  Sales: { icon: "📈", label: "Sales" },
  Leaderboard: { icon: "🏅", label: "Leaderboard" },
};

const TYPE_STYLES = {
  mention: { icon: "👤", label: "Mention" },
};

function getCategoryInfo(category, type = "") {
  return TYPE_STYLES[type] || CATEGORY_STYLES[category] || { icon: "🔔", label: category || "System" };
}

function formatNotificationTime(value) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getInitials(profile) {
  const source = profile?.full_name || profile?.email || "User";

  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function NotificationIcon({ item, categoryInfo, isDark }) {
  const actor = item?.actor;
  const typeIcon = TYPE_STYLES[item?.type]?.icon || "";

  if (actor?.avatar_url) {
    return (
      <span className="relative h-11 w-11 shrink-0">
        <img
          src={actor.avatar_url}
          alt=""
          className={`h-11 w-11 rounded-2xl object-cover ${
            isDark ? "bg-slate-900" : "bg-[#f6e8ff]"
          }`}
        />
        {typeIcon ? (
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#c446ff] text-[10px] text-white">
            {typeIcon}
          </span>
        ) : null}
      </span>
    );
  }

  if (actor) {
    return (
      <span className="relative h-11 w-11 shrink-0">
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-bold ${
            isDark ? "bg-slate-900 text-slate-100" : "bg-[#f6e8ff] text-[#8f29c8]"
          }`}
        >
          {getInitials(actor)}
        </span>
        {typeIcon ? (
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#c446ff] text-[10px] text-white">
            {typeIcon}
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <span
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl ${
        isDark ? "bg-slate-900" : "bg-[#f6e8ff]"
      }`}
    >
      {categoryInfo.icon}
    </span>
  );
}

function NotificationsPage() {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [markingById, setMarkingById] = useState({});
  const [markingAll, setMarkingAll] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(async ({ showLoading = true } = {}) => {
    console.log("FETCH NOTIFICATIONS", { source: "notifications_page" });
    if (showLoading) {
      setLoading(true);
    }
    setError("");

    const { data, error: fetchError } = await getMyNotificationsResult();

    if (fetchError) {
      setNotifications([]);
      setError("Unable to load notifications right now. Please try again.");
      if (showLoading) {
        setLoading(false);
      }
      return;
    }

    const nextNotifications = data || [];
    setNotifications(nextNotifications);
    setUnreadCount(nextNotifications.filter((item) => !item.is_read).length);
    console.log("STATE UPDATED", { source: "notifications_page", count: nextNotifications.length });
    if (showLoading) {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    return subscribeToMyNotifications(() => {
      loadNotifications({ showLoading: false });
    });
  }, [loadNotifications]);

  useEffect(() => {
    return subscribeToUnreadNotificationCount(setUnreadCount);
  }, []);

  const filteredNotifications = useMemo(() => {
    return notifications
      .filter((item) => {
        const category = item.category || item.type || "System";

        if (activeFilter === "unread") {
          return !item.is_read;
        }

        if (activeFilter === "all") {
          return true;
        }

        return category === activeFilter;
      })
      .sort((left, right) => new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime());
  }, [activeFilter, notifications]);

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
      setSelectedNotification((current) =>
        current?.id === id ? { ...current, is_read: true, ...data } : current
      );
    }

    setMarkingById((current) => ({
      ...current,
      [id]: false,
    }));
  };

  const handleMarkAllRead = async () => {
    if (!unreadCount || markingAll) {
      return;
    }

    setMarkingAll(true);
    setError("");

    const { error: markError } = await markAllNotificationsRead();

    if (!markError) {
      setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
      setSelectedNotification((current) => (current ? { ...current, is_read: true } : current));
    } else {
      setError("Unable to mark notifications as read right now. Please try again.");
    }

    setMarkingAll(false);
  };

  const openNotification = (item) => {
    setSelectedNotification(item);

    if (!item.is_read) {
      handleMarkRead(item.id);
    }
  };

  const handleAction = (item) => {
    const actionUrl = getNotificationActionUrl(item);

    if (actionUrl) {
      navigate(actionUrl);
    }
  };

  return (
    <section className="space-y-5 pb-24 sm:space-y-6 sm:pb-0">
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className={`text-2xl font-bold ${isDark ? "text-slate-100" : "text-slate-950"}`}>Notifications</h1>
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={!unreadCount || markingAll}
            className={`h-10 shrink-0 rounded-2xl border px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
              isDark
                ? "border-[#c446ff]/50 bg-slate-950 text-[#e4b3ff] hover:bg-[#c446ff]/10"
                : "border-[#c446ff]/35 bg-white text-[#9d2bd5] hover:bg-[#f8e9ff]"
            }`}
          >
            {markingAll ? "Marking..." : "Mark all as read"}
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((filter) => {
            const isActive = activeFilter === filter.id;

            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setActiveFilter(filter.id)}
                className={`h-10 shrink-0 rounded-2xl px-4 text-sm font-semibold transition ${
                  isActive
                    ? "bg-[#c446ff] text-white"
                    : isDark
                      ? "bg-slate-900 text-slate-300 hover:bg-slate-800"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </header>

      {loading ? (
        <div
          className={`rounded-3xl border p-5 text-sm ${
            isDark ? "border-slate-800 bg-slate-950 text-slate-300" : "border-slate-200 bg-white text-slate-600"
          }`}
        >
          Loading notifications...
        </div>
      ) : null}

      {!loading && error ? (
        <div
          className={`rounded-3xl border p-5 ${
            isDark ? "border-rose-900 bg-rose-950/30 text-rose-200" : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          <p className="text-sm font-medium">{error}</p>
          <button
            type="button"
            onClick={loadNotifications}
            className={`mt-4 h-10 rounded-2xl border px-4 text-sm font-semibold transition ${
              isDark
                ? "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
            }`}
          >
            Retry
          </button>
        </div>
      ) : null}

      {!loading && !error && !filteredNotifications.length ? (
        <div
          className={`rounded-3xl border p-8 text-center ${
            isDark ? "border-slate-800 bg-slate-950 text-slate-300" : "border-slate-200 bg-white text-slate-600"
          }`}
        >
          <div className="text-4xl">🔔</div>
          <h2 className={`mt-3 text-lg font-bold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
            No notifications yet.
          </h2>
        </div>
      ) : null}

      {!loading && !error && filteredNotifications.length ? (
        <div className="space-y-3">
          {filteredNotifications.map((item) => {
            const category = item.category || item.type || "System";
            const categoryInfo = getCategoryInfo(category, item.type);

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => openNotification(item)}
                className={`w-full rounded-3xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 sm:p-5 ${
                  isDark
                    ? "border-slate-800 bg-slate-950 text-slate-200 shadow-slate-950/20 hover:border-[#c446ff]/50"
                    : "border-slate-200 bg-white text-slate-700 hover:border-[#c446ff]/40"
                }`}
              >
                <div className="flex items-start gap-3">
                  <NotificationIcon item={item} categoryInfo={categoryInfo} isDark={isDark} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className={`truncate text-base font-bold ${isDark ? "text-slate-100" : "text-slate-950"}`}>
                          {item.title || "Notification"}
                        </h3>
                        <p className={`mt-1 line-clamp-2 text-sm leading-6 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                          {item.message || item.body || "No details provided."}
                        </p>
                      </div>
                      {!item.is_read ? <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#c446ff]" /> : null}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isDark ? "bg-slate-900 text-slate-300" : "bg-slate-100 text-slate-600"}`}>
                        {categoryInfo.label}
                      </span>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.is_read ? "text-slate-500" : "bg-[#c446ff]/15 text-[#c446ff]"}`}>
                        {item.is_read ? "Read" : "● Unread"}
                      </span>
                      <span className="ml-auto text-xs font-semibold text-slate-500">
                        {formatNotificationTime(item.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : null}

      {selectedNotification ? (
        <div className="fixed inset-0 z-[80] flex items-end bg-slate-950/70 px-3 py-4 sm:items-center sm:justify-center">
          <div
            className={`w-full rounded-3xl border p-5 shadow-2xl sm:max-w-lg ${
              isDark ? "border-slate-800 bg-slate-950 text-slate-100" : "border-slate-200 bg-white text-slate-900"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#c446ff]">
                  {getCategoryInfo(selectedNotification.category, selectedNotification.type).label}
                </p>
                <h2 className="mt-2 text-xl font-bold">{selectedNotification.title}</h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {formatNotificationTime(selectedNotification.created_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNotification(null)}
                className={`h-10 w-10 rounded-full text-lg transition ${
                  isDark ? "bg-slate-900 text-slate-300 hover:bg-slate-800" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
                aria-label="Close notification detail"
              >
                ×
              </button>
            </div>

            <p className={`mt-5 whitespace-pre-wrap text-sm leading-7 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
              {selectedNotification.message || selectedNotification.body || "No details provided."}
            </p>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
              {getNotificationActionUrl(selectedNotification) ? (
                <button
                  type="button"
                  onClick={() => handleAction(selectedNotification)}
                  className="h-11 rounded-2xl bg-[#c446ff] px-5 text-sm font-semibold text-white transition hover:bg-[#ad32e3]"
                >
                  Open
                </button>
              ) : null}
              {!selectedNotification.is_read ? (
                <button
                  type="button"
                  onClick={() => handleMarkRead(selectedNotification.id)}
                  disabled={Boolean(markingById[selectedNotification.id])}
                  className={`h-11 rounded-2xl border px-5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${
                    isDark
                      ? "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {markingById[selectedNotification.id] ? "Marking..." : "Mark as Read"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default NotificationsPage;
