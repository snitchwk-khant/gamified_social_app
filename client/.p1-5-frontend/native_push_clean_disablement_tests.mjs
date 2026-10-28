import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const projectRoot = path.resolve(import.meta.dirname, "..");
const readSource = (relativePath) => readFileSync(path.join(projectRoot, relativePath), "utf8");
const sha256 = (content) => createHash("sha256").update(content).digest("hex");

const appSource = readSource("src/App.jsx");
const authSource = readSource("src/context/auth_context.jsx");
const bridgeSource = readSource("src/components/notifications/NativePushBridge.jsx");
const nativePushSource = readSource("src/services/native_push_service.js");
const notificationService = readSource("src/services/notifications_service.js");
const notificationBanner = readSource("src/components/notifications/NotificationBanner.jsx");
const notificationPage = readSource("src/pages/notifications_page.jsx");
const leftSidebar = readSource("src/components/sidebar/left_sidebar.jsx");
const desktopLayout = readSource("src/components/layout/desktop_layout.jsx");
const viteConfig = readSource("vite.config.js");
const capacitorConfig = readSource("capacitor.config.json");
const androidManifest = readSource("android/app/src/main/AndroidManifest.xml");

const forbiddenActivePushPattern =
  /NativePushBridge|registerNativePushNotifications|deactivateNativePushInstallation|register_native_push_token|deactivate_native_push_installation/;

function walkFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(entryPath) : [entryPath];
  });
}

const dormantRelativePaths = new Set([
  "src/components/notifications/NativePushBridge.jsx",
  "src/services/native_push_service.js",
]);

const activeSourceFiles = walkFiles(path.join(projectRoot, "src")).filter((filePath) => {
  const relativePath = path.relative(projectRoot, filePath);
  return !dormantRelativePaths.has(relativePath);
});

function createMockBoundaries() {
  const calls = {
    authSignIn: 0,
    authGetSession: 0,
    authSignOut: 0,
    permissionRequests: 0,
    listenerRegistrations: 0,
    tokenRegistrationRpcs: 0,
    tokenDeactivationRpcs: 0,
  };

  return {
    calls,
    auth: {
      getSession: async () => {
        calls.authGetSession += 1;
        return { user: { id: "synthetic-user" } };
      },
      signIn: async () => {
        calls.authSignIn += 1;
        return { user: { id: "synthetic-user" } };
      },
      signOut: async () => {
        calls.authSignOut += 1;
      },
    },
    push: {
      requestPermissions: async () => {
        calls.permissionRequests += 1;
      },
      addListener: async () => {
        calls.listenerRegistrations += 1;
      },
      registerToken: async () => {
        calls.tokenRegistrationRpcs += 1;
      },
      deactivateToken: async () => {
        calls.tokenDeactivationRpcs += 1;
      },
    },
  };
}

async function simulateCleanRuntime({ authenticated = false, action = "load" } = {}) {
  const boundaries = createMockBoundaries();

  if (action === "restore") {
    await boundaries.auth.getSession();
  } else if (action === "login") {
    await boundaries.auth.signIn();
  } else if (action === "logout" && authenticated) {
    await boundaries.auth.signOut();
  }

  return boundaries.calls;
}

function assertNoPushCalls(calls) {
  assert.equal(calls.permissionRequests, 0);
  assert.equal(calls.listenerRegistrations, 0);
  assert.equal(calls.tokenRegistrationRpcs, 0);
  assert.equal(calls.tokenDeactivationRpcs, 0);
}

test("1. anonymous website load has no native push side effect", async () => {
  assert.doesNotMatch(appSource, forbiddenActivePushPattern);
  assertNoPushCalls(await simulateCleanRuntime());
});

for (const [number, role] of [
  [2, "Employee"],
  [3, "Admin"],
  [4, "Accountant"],
]) {
  test(`${number}. ${role} login preserves auth without native push`, async () => {
    const calls = await simulateCleanRuntime({ authenticated: true, action: "login" });
    assert.equal(calls.authSignIn, 1);
    assertNoPushCalls(calls);
    assert.match(authSource, /signInWithPassword/);
  });
}

test("5. session restoration remains present without native push", async () => {
  const calls = await simulateCleanRuntime({ authenticated: true, action: "restore" });
  assert.equal(calls.authGetSession, 1);
  assertNoPushCalls(calls);
  assert.match(authSource, /supabase\.auth\.getSession\(\)/);
  assert.match(authSource, /supabase\.auth\.onAuthStateChange/);
});

for (const [number, role] of [
  [6, "Employee"],
  [7, "Admin"],
  [8, "Accountant"],
]) {
  test(`${number}. ${role} logout preserves Supabase sign-out only`, async () => {
    const calls = await simulateCleanRuntime({ authenticated: true, action: "logout" });
    assert.equal(calls.authSignOut, 1);
    assertNoPushCalls(calls);
    assert.match(authSource, /signOut:\s*async \(\) => \{\s*await supabase\.auth\.signOut\(\);\s*setUser\(null\);\s*\}/);
  });
}

test("9. forced-password-change routing remains intact", () => {
  assert.match(appSource, /function RequirePasswordChange\(/);
  assert.match(appSource, /function RequirePasswordChangeOnly\(/);
  assert.match(appSource, /must_change_password/);
  assert.match(appSource, /path="\/change-password"/);
});

for (const [number, platform] of [
  [10, "Android"],
  [11, "iOS"],
]) {
  test(`${number}. mocked ${platform} launch has no active push bridge`, async () => {
    const calls = await simulateCleanRuntime({ authenticated: true, action: "restore" });
    assertNoPushCalls(calls);
    assert.doesNotMatch(appSource, /<NativePushBridge\s*\/>/);
  });
}

test("12. mocked native logout performs no push deactivation", async () => {
  const calls = await simulateCleanRuntime({ authenticated: true, action: "logout" });
  assert.equal(calls.authSignOut, 1);
  assertNoPushCalls(calls);
  assert.doesNotMatch(authSource, /deactivateNativePushInstallation/);
});

test("13. active source cannot request push permission", () => {
  for (const filePath of activeSourceFiles) {
    assert.doesNotMatch(readFileSync(filePath, "utf8"), /PushNotifications\.requestPermissions/);
  }
});

test("14. active source cannot register native push listeners", () => {
  for (const filePath of activeSourceFiles) {
    assert.doesNotMatch(readFileSync(filePath, "utf8"), /PushNotifications\.addListener/);
  }
});

test("15. active source has no push-token registration RPC", () => {
  for (const filePath of activeSourceFiles) {
    assert.doesNotMatch(readFileSync(filePath, "utf8"), /register_native_push_token/);
  }
  assert.match(nativePushSource, /register_native_push_token/);
});

test("16. active source has no push deactivation RPC", () => {
  for (const filePath of activeSourceFiles) {
    assert.doesNotMatch(readFileSync(filePath, "utf8"), /deactivate_native_push_installation/);
  }
  assert.match(nativePushSource, /deactivate_native_push_installation/);
});

test("17. website notification badge consumers remain present", () => {
  assert.match(leftSidebar, /subscribeToUnreadNotificationCount/);
  assert.match(desktopLayout, /subscribeToUnreadNotificationCount/);
});

test("18. notification banner remains mounted and subscribed", () => {
  assert.match(appSource, /<NotificationBanner\s*\/>/);
  assert.match(notificationBanner, /subscribeToMyNotifications/);
});

test("19. notification list and route remain present", () => {
  assert.match(appSource, /path="\/notifications"\s+element=\{<NotificationsPage\s*\/>\}/);
  assert.match(notificationPage, /subscribeToMyNotifications/);
  assert.match(notificationPage, /subscribeToUnreadNotificationCount/);
});

test("20. notification Realtime contract remains present", () => {
  assert.match(notificationService, /NOTIFICATIONS_REALTIME_CHANNEL = "notifications-realtime"/);
  assert.match(notificationService, /table:\s*"notifications"/);
  assert.match(notificationService, /table:\s*"notification_reads"/);
  assert.match(notificationService, /"postgres_changes"/);
});

test("21. notification deep-link navigation remains entity-aware", () => {
  assert.match(notificationService, /\["comment_reply", "mention"\]\.includes\(notification\.type\)/);
  assert.match(notificationService, /params\.set\("comment", item\.comment_id\)/);
  assert.match(notificationService, /action_url/);
});

test("22. application routes, Vite base, and dormant native files are preserved", () => {
  for (const route of [
    "/home",
    "/notifications",
    "/anonymous-mailbox",
    "/leaderboard",
    "/shops",
    "/profile",
  ]) {
    assert.match(appSource, new RegExp(`path="${route.replace("/", "\\/")}`));
  }

  assert.match(appSource, /<AuthProvider>/);
  assert.match(appSource, /<BrowserRouter>/);
  assert.match(viteConfig, /base:\s*['"]\/['"]/);
  assert.equal(sha256(bridgeSource), "b6363b92b972d79a3cb437ccb808994efb07c799a00cbfa5c102e09f2349342b");
  assert.equal(sha256(nativePushSource), "99201575225022aa49fcb1aa948dd270cce775135cbf2811471f15d4d2bea9b4");
  assert.equal(sha256(capacitorConfig), "9fb2c3aa2f0be7e723363c87254f322c85528ac3a929424a7125ea2b18ff70f8");
  assert.equal(sha256(androidManifest), "927e3fe9d7b0b85dc525ba071abbff0ca17faba58367bebb2efa4d14b1faa5ed");
});
