import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "../lib/supabase";

const APP_ID = "com.gemify.app";
const INSTALLATION_ID_KEY = "gemify_native_installation_id";
const ANDROID_DEFAULT_CHANNEL_ID = "gemify_default";

let activeRegistration = null;

function isNativePushPlatform() {
  if (typeof Capacitor.isNativePlatform !== "function" || !Capacitor.isNativePlatform()) {
    return false;
  }

  return ["android", "ios"].includes(Capacitor.getPlatform());
}

function getInstallationId() {
  if (typeof window === "undefined") {
    return "";
  }

  const existingId = window.localStorage.getItem(INSTALLATION_ID_KEY);

  if (existingId) {
    return existingId;
  }

  const nextId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  window.localStorage.setItem(INSTALLATION_ID_KEY, nextId);
  return nextId;
}

async function persistPushToken(tokenValue) {
  const token = tokenValue?.trim();
  const installationId = getInstallationId();

  if (!token || !installationId) {
    return null;
  }

  const { data, error } = await supabase.rpc("register_native_push_token", {
    push_token: token,
    push_platform: Capacitor.getPlatform(),
    push_installation_id: installationId,
    push_app_id: APP_ID,
  });

  if (error) {
    console.error("Native push token registration error:", error);
  }

  return { data, error };
}

function resolvePushActionUrl(notification) {
  const data = notification?.notification?.data || notification?.data || {};
  return data.action_url || data.actionUrl || data.url || "/notifications";
}

async function removeListeners(handles = []) {
  await Promise.all(
    handles.map((handle) => {
      if (typeof handle?.remove === "function") {
        return handle.remove();
      }

      return null;
    })
  );
}

async function ensureAndroidNotificationChannel() {
  if (Capacitor.getPlatform() !== "android") {
    return;
  }

  try {
    await PushNotifications.createChannel({
      id: ANDROID_DEFAULT_CHANNEL_ID,
      name: "Gemify Notifications",
      description: "Rank, target, message, and social updates from Gemify.",
      importance: 4,
      visibility: 1,
      lights: true,
      lightColor: "#C446FF",
      vibration: true,
    });
  } catch (error) {
    console.error("Android notification channel setup error:", error);
  }
}

export function isNativePushSupported() {
  return isNativePushPlatform();
}

export async function registerNativePushNotifications({ onForegroundNotification, onNotificationAction } = {}) {
  if (!isNativePushPlatform()) {
    return () => undefined;
  }

  if (activeRegistration) {
    await activeRegistration.stop();
  }

  const handles = [];
  const registration = {
    stop: async () => {
      await removeListeners(handles);
      if (activeRegistration === registration) {
        activeRegistration = null;
      }
    },
  };

  activeRegistration = registration;

  try {
    await ensureAndroidNotificationChannel();

    const permissionStatus = await PushNotifications.checkPermissions();
    const receivePermission =
      permissionStatus.receive === "prompt"
        ? (await PushNotifications.requestPermissions()).receive
        : permissionStatus.receive;

    if (receivePermission !== "granted") {
      return registration.stop;
    }

    handles.push(
      await PushNotifications.addListener("registration", (token) => {
        persistPushToken(token?.value || "").catch((error) => {
          console.error("Native push token persistence error:", error);
        });
      })
    );

    handles.push(
      await PushNotifications.addListener("registrationError", (error) => {
        console.error("Native push registration error:", error);
      })
    );

    handles.push(
      await PushNotifications.addListener("pushNotificationReceived", (notification) => {
        if (typeof onForegroundNotification === "function") {
          onForegroundNotification(notification);
        }
      })
    );

    handles.push(
      await PushNotifications.addListener("pushNotificationActionPerformed", (notification) => {
        const actionUrl = resolvePushActionUrl(notification);
        const notificationId =
          notification?.notification?.data?.notification_id ||
          notification?.notification?.data?.notificationId ||
          notification?.data?.notification_id ||
          notification?.data?.notificationId ||
          null;

        if (typeof onNotificationAction === "function") {
          onNotificationAction({ actionUrl, notificationId, notification });
        }
      })
    );

    await PushNotifications.register();
  } catch (error) {
    console.error("Native push setup error:", error);
  }

  return registration.stop;
}

export async function deactivateNativePushInstallation() {
  if (!isNativePushPlatform()) {
    return;
  }

  const installationId = getInstallationId();

  if (!installationId) {
    return;
  }

  const { error } = await supabase.rpc("deactivate_native_push_installation", {
    push_installation_id: installationId,
  });

  if (error) {
    console.error("Native push deactivation error:", error);
  }
}

const NativePushService = {
  deactivateInstallation: deactivateNativePushInstallation,
  isSupported: isNativePushSupported,
  register: registerNativePushNotifications,
};

export default NativePushService;
