import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/auth_context";
import { markNotificationRead, refreshUnreadNotificationCount } from "../../services/notifications_service";
import { registerNativePushNotifications } from "../../services/native_push_service";

function NativePushBridge() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !user?.id) {
      return undefined;
    }

    let stopNativePush = null;
    let isMounted = true;

    registerNativePushNotifications({
      onForegroundNotification: () => {
        refreshUnreadNotificationCount();
      },
      onNotificationAction: async ({ actionUrl, notificationId }) => {
        if (notificationId) {
          await markNotificationRead(notificationId);
        }

        if (isMounted && actionUrl) {
          navigate(actionUrl);
        }
      },
    }).then((stop) => {
      stopNativePush = stop;
    });

    return () => {
      isMounted = false;

      if (typeof stopNativePush === "function") {
        stopNativePush();
      }
    };
  }, [loading, navigate, user?.id]);

  return null;
}

export default NativePushBridge;
