import { Capacitor } from "@capacitor/core";

export function registerServiceWorker() {
  const isHttpApp = ["http:", "https:"].includes(window.location.protocol);

  if (Capacitor.isNativePlatform?.() || !("serviceWorker" in navigator) || !import.meta.env.PROD || !isHttpApp) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Gemify service worker registration failed:", error);
    });
  });
}
