import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../context/theme_context";
import {
  getMyNotificationsResult,
  getNotificationActionUrl,
  markNotificationRead,
  subscribeToMyNotifications,
} from "../../services/notifications_service";
import { successNotification } from "../../services/haptics";

const BANNER_DURATION_MS = 4500;

function getNotificationText(notification) {
  return notification?.message || notification?.body || notification?.title || "You have a new notification.";
}

function NotificationBanner() {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [visibleNotification, setVisibleNotification] = useState(null);
  const seenNotificationIds = useRef(new Set());
  const hideTimer = useRef(null);
  const initialized = useRef(false);

  const hideBanner = useCallback(() => {
    setVisibleNotification(null);
  }, []);

  const openNotification = useCallback(
    async (notification) => {
      if (!notification?.id) {
        return;
      }

      await markNotificationRead(notification.id);
      hideBanner();

      const actionUrl = getNotificationActionUrl(notification);

      if (actionUrl) {
        navigate(actionUrl);
      }
    },
    [hideBanner, navigate]
  );

  const loadAndSurfaceLatestNotification = useCallback(async () => {
    const { data, error } = await getMyNotificationsResult();

    if (error) {
      return;
    }

    const notifications = data || [];
    const unseenUnread = notifications
      .filter((notification) => notification?.id && !notification.is_read && !seenNotificationIds.current.has(notification.id))
      .sort((left, right) => new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime());

    notifications.forEach((notification) => {
      if (notification?.id) {
        seenNotificationIds.current.add(notification.id);
      }
    });

    const latest = unseenUnread[0];

    if (!latest || !initialized.current) {
      initialized.current = true;
      return;
    }

    successNotification();

    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }

    setVisibleNotification(latest);
  }, []);

  useEffect(() => {
    loadAndSurfaceLatestNotification();
    return subscribeToMyNotifications(loadAndSurfaceLatestNotification);
  }, [loadAndSurfaceLatestNotification]);

  useEffect(() => {
    if (!visibleNotification) {
      return undefined;
    }

    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(hideBanner, BANNER_DURATION_MS);

    return () => {
      window.clearTimeout(hideTimer.current);
    };
  }, [hideBanner, visibleNotification]);

  if (!visibleNotification) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed left-0 right-0 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] z-[95] flex justify-center px-4">
      <button
        type="button"
        onClick={() => openNotification(visibleNotification)}
        className={`pointer-events-auto w-full max-w-md rounded-3xl border p-4 text-left shadow-2xl transition hover:-translate-y-0.5 ${
          isDark
            ? "border-[#c446ff]/40 bg-slate-950/95 text-slate-100 shadow-[#c446ff]/10"
            : "border-[#c446ff]/30 bg-white/95 text-slate-900 shadow-slate-900/10"
        }`}
      >
        <div className="flex items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-xl ${isDark ? "bg-slate-900" : "bg-[#f6e8ff]"}`}>
            🔔
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{visibleNotification.title || "Gemify"}</p>
            <p className={`mt-1 line-clamp-2 text-sm ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              {getNotificationText(visibleNotification)}
            </p>
          </div>
        </div>
      </button>
    </div>
  );
}

export default NotificationBanner;
