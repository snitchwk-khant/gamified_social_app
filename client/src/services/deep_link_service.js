import { App as CapacitorApp } from "@capacitor/app";

const GEMIFY_HOST = "gemify.app";
const CUSTOM_SCHEME = "gemify:";
const HOME_PATH = "/home";

let appUrlOpenListener = null;
let startPromise = null;

function compactSegments(pathname = "") {
  return pathname.split("/").map((segment) => segment.trim()).filter(Boolean);
}

function getUrlFromPayload(payload) {
  if (!payload) {
    return "";
  }

  if (typeof payload === "string") {
    return payload;
  }

  return payload.url || payload.link || payload.deepLink || payload.deep_link || payload.data?.url || payload.data?.deepLink || "";
}

function parseCustomScheme(url) {
  const parsedUrl = new URL(url);
  const segments = [];

  if (parsedUrl.hostname) {
    segments.push(parsedUrl.hostname);
  }

  segments.push(...compactSegments(parsedUrl.pathname));

  return segments;
}

function parseUniversalLink(url) {
  const parsedUrl = new URL(url);

  if (parsedUrl.hostname !== GEMIFY_HOST) {
    return [];
  }

  return compactSegments(parsedUrl.pathname);
}

function isValidId(value) {
  return typeof value === "string" && value.trim().length > 0 && !value.includes("/") && !value.includes("?") && !value.includes("#");
}

export function resolveDeepLink(input) {
  const url = getUrlFromPayload(input);

  if (!url) {
    return {
      isValid: false,
      path: HOME_PATH,
      reason: "missing_url",
      url: "",
    };
  }

  try {
    const normalizedUrl = url.trim();
    const parsedUrl = new URL(normalizedUrl);
    const segments = parsedUrl.protocol === CUSTOM_SCHEME ? parseCustomScheme(normalizedUrl) : parseUniversalLink(normalizedUrl);
    const [route, id] = segments;

    switch (route) {
      case "home":
      case "":
      case undefined:
        return { isValid: true, path: HOME_PATH, url: normalizedUrl };
      case "profile":
        return isValidId(id)
          ? { isValid: true, path: `/profile/${encodeURIComponent(id)}`, url: normalizedUrl }
          : { isValid: false, path: HOME_PATH, reason: "missing_profile_id", url: normalizedUrl };
      case "post":
        return isValidId(id)
          ? { isValid: true, path: `/home?post=${encodeURIComponent(id)}`, url: normalizedUrl }
          : { isValid: false, path: HOME_PATH, reason: "missing_post_id", url: normalizedUrl };
      case "leaderboard":
        return { isValid: true, path: "/leaderboard", url: normalizedUrl };
      case "monthly-result":
      case "monthly-results":
      case "monthly-champions":
        return { isValid: true, path: "/monthly-champions", url: normalizedUrl };
      case "conversation":
      case "messages":
        if (isValidId(id)) {
          return { isValid: true, path: `/anonymous-mailbox?conversation=${encodeURIComponent(id)}`, url: normalizedUrl };
        }
        return { isValid: true, path: "/anonymous-mailbox", url: normalizedUrl };
      case "shop-target":
        return { isValid: true, path: "/admin/sales-targets", url: normalizedUrl };
      case "notifications":
        return { isValid: true, path: "/notifications", url: normalizedUrl };
      case "settings":
        return { isValid: true, path: "/profile", url: normalizedUrl };
      default:
        return { isValid: false, path: HOME_PATH, reason: "unknown_route", url: normalizedUrl };
    }
  } catch {
    return {
      isValid: false,
      path: HOME_PATH,
      reason: "invalid_url",
      url,
    };
  }
}

export function navigateToDeepLink(input, navigate) {
  const result = resolveDeepLink(input);

  if (typeof navigate === "function") {
    navigate(result.path, { replace: false });
  }

  return result;
}

export function handleBrowserDeepLink(navigate) {
  if (typeof window === "undefined") {
    return null;
  }

  const currentUrl = new URL(window.location.href);
  const embeddedLink = currentUrl.searchParams.get("link") || currentUrl.searchParams.get("deep_link");
  const candidateUrl = embeddedLink || currentUrl.href;
  const result = resolveDeepLink(candidateUrl);

  if (result.url && (embeddedLink || currentUrl.hostname === GEMIFY_HOST)) {
    if (typeof navigate === "function") {
      navigate(result.path, { replace: true });
    }

    return result;
  }

  return null;
}

export async function startDeepLinkService(navigate) {
  if (startPromise) {
    return startPromise;
  }

  startPromise = (async () => {
    handleBrowserDeepLink(navigate);

    try {
      const launchUrl = await CapacitorApp.getLaunchUrl();

      if (launchUrl?.url) {
        navigateToDeepLink(launchUrl.url, navigate);
      }

      appUrlOpenListener = await CapacitorApp.addListener("appUrlOpen", (event) => {
        navigateToDeepLink(event?.url, navigate);
      });
    } catch (error) {
      console.error("Deep link service start error:", error);
    }
  })();

  return startPromise;
}

export async function stopDeepLinkService() {
  if (appUrlOpenListener?.remove) {
    await appUrlOpenListener.remove();
  }

  appUrlOpenListener = null;
  startPromise = null;
}

const DeepLinkService = {
  handleBrowser: handleBrowserDeepLink,
  navigate: navigateToDeepLink,
  resolve: resolveDeepLink,
  start: startDeepLinkService,
  stop: stopDeepLinkService,
};

export default DeepLinkService;
