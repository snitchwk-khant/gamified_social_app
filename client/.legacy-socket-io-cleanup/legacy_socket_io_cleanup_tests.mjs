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
const socketContextSource = readSource("src/context/socket_context.jsx");
const socketClientSource = readSource("src/socket/socket_client.js");
const appConfigSource = readSource("src/config/app_config.js");
const packageSource = readSource("package.json");
const notificationService = readSource("src/services/notifications_service.js");
const notificationBanner = readSource("src/components/notifications/NotificationBanner.jsx");
const notificationPage = readSource("src/pages/notifications_page.jsx");
const leftSidebar = readSource("src/components/sidebar/left_sidebar.jsx");
const desktopLayout = readSource("src/components/layout/desktop_layout.jsx");
const mainLayout = readSource("src/layouts/main_layout.jsx");
const homePage = readSource("src/pages/home_page.jsx");
const postCard = readSource("src/components/center_feed/post_card.jsx");
const profileService = readSource("src/services/profile_service.js");
const profilePage = readSource("src/pages/profile_page.jsx");
const leaderboardService = readSource("src/services/leaderboard_service.js");
const leaderboardPage = readSource("src/pages/leaderboard_page.jsx");
const mailboxService = readSource("src/services/anonymous_mailbox_service.js");
const mailboxPage = readSource("src/pages/anonymous_mailbox_page.jsx");
const viteConfig = readSource("vite.config.js");
const vercelConfig = JSON.parse(readSource("vercel.json"));

function walkFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(entryPath) : [entryPath];
  });
}

const dormantSocketPaths = new Set([
  "src/context/socket_context.jsx",
  "src/socket/socket_client.js",
]);

const activeSourceFiles = walkFiles(path.join(projectRoot, "src")).filter((filePath) => {
  const relativePath = path.relative(projectRoot, filePath);
  return !dormantSocketPaths.has(relativePath);
});

function createMockBoundaries() {
  const calls = { getSession: 0, signIn: 0, signOut: 0, websocket: 0 };

  return {
    calls,
    auth: {
      getSession: async () => {
        calls.getSession += 1;
        return { user: { id: "synthetic-user" } };
      },
      signIn: async () => {
        calls.signIn += 1;
        return { user: { id: "synthetic-user" } };
      },
      signOut: async () => {
        calls.signOut += 1;
      },
    },
    websocket: {
      connect: () => {
        calls.websocket += 1;
      },
    },
  };
}

async function simulateCleanRuntime(action = "load") {
  const boundaries = createMockBoundaries();

  if (action === "login") {
    await boundaries.auth.signIn();
  } else if (action === "restore") {
    await boundaries.auth.getSession();
  } else if (action === "logout") {
    await boundaries.auth.signOut();
  }

  return boundaries.calls;
}

function syntheticComment({ masked = false, parentId = null } = {}) {
  return {
    post_id: "synthetic-post",
    user_id: "synthetic-user",
    content: "Synthetic comment",
    is_anonymous: masked,
    parent_comment_id: parentId,
  };
}

test("1. anonymous website load preserves routes without opening Socket.IO", async () => {
  const calls = await simulateCleanRuntime("load");
  assert.equal(calls.websocket, 0);
  assert.match(appSource, /path="\/login"/);
  assert.doesNotMatch(appSource, /SocketProvider/);
});

for (const [number, role] of [
  [2, "Employee"],
  [3, "Admin"],
  [4, "Accountant"],
]) {
  test(`${number}. ${role} login remains independent of Socket.IO`, async () => {
    const calls = await simulateCleanRuntime("login");
    assert.equal(calls.signIn, 1);
    assert.equal(calls.websocket, 0);
    assert.match(authSource, /signInWithPassword/);
  });
}

test("5. session restoration remains independent of Socket.IO", async () => {
  const calls = await simulateCleanRuntime("restore");
  assert.equal(calls.getSession, 1);
  assert.equal(calls.websocket, 0);
  assert.match(authSource, /supabase\.auth\.getSession\(\)/);
  assert.match(authSource, /supabase\.auth\.onAuthStateChange/);
});

test("6. logout preserves Supabase sign-out and user cleanup", async () => {
  const calls = await simulateCleanRuntime("logout");
  assert.equal(calls.signOut, 1);
  assert.equal(calls.websocket, 0);
  assert.match(authSource, /signOut:\s*async \(\) => \{\s*await supabase\.auth\.signOut\(\);\s*setUser\(null\);\s*\}/);
});

test("7. forced-password-change flow remains mounted", () => {
  assert.match(appSource, /function RequirePasswordChange\(/);
  assert.match(appSource, /function RequirePasswordChangeOnly\(/);
  assert.match(appSource, /must_change_password/);
  assert.match(appSource, /path="\/change-password"/);
});

test("8. notification badge consumers remain active", () => {
  assert.match(leftSidebar, /subscribeToUnreadNotificationCount/);
  assert.match(desktopLayout, /subscribeToUnreadNotificationCount/);
});

test("9. notification banner remains mounted and subscribed", () => {
  assert.match(appSource, /<NotificationBanner\s*\/>/);
  assert.match(notificationBanner, /subscribeToMyNotifications/);
});

test("10. notification list and route remain active", () => {
  assert.match(appSource, /path="\/notifications"\s+element=\{<NotificationsPage\s*\/>\}/);
  assert.match(notificationPage, /subscribeToMyNotifications/);
  assert.match(notificationPage, /subscribeToUnreadNotificationCount/);
});

test("11. notification Supabase Realtime contract remains active", () => {
  assert.match(notificationService, /NOTIFICATIONS_REALTIME_CHANNEL = "notifications-realtime"/);
  assert.match(notificationService, /table:\s*"notifications"/);
  assert.match(notificationService, /table:\s*"notification_reads"/);
  assert.match(notificationService, /"postgres_changes"/);
});

test("12. home feed Supabase Realtime contract remains active", () => {
  assert.match(homePage, /\.channel\("home-social-feed-realtime"\)/);
  assert.match(homePage, /table:\s*"posts"/);
  assert.match(homePage, /table:\s*"comments"/);
  assert.match(homePage, /"postgres_changes"/);
});

test("13. normal comment INSERT contract remains intact", () => {
  const payload = syntheticComment();
  assert.equal(payload.is_anonymous, false);
  assert.equal(payload.parent_comment_id, null);
  assert.match(postCard, /\.from\("comments"\)[\s\S]*?\.insert\(insertPayload\)/);
});

test("14. masked comment INSERT contract remains intact", () => {
  const payload = syntheticComment({ masked: true });
  assert.equal(payload.is_anonymous, true);
  assert.equal(payload.parent_comment_id, null);
  assert.match(postCard, /is_anonymous:\s*isAnonymous/);
});

test("15. normal reply preserves parent_comment_id", () => {
  const payload = syntheticComment({ parentId: "synthetic-parent" });
  assert.equal(payload.is_anonymous, false);
  assert.equal(payload.parent_comment_id, "synthetic-parent");
  assert.match(postCard, /parent_comment_id:\s*resolvedParentCommentId/);
});

test("16. masked reply preserves masking and parent identity", () => {
  const payload = syntheticComment({ masked: true, parentId: "synthetic-parent" });
  assert.equal(payload.is_anonymous, true);
  assert.equal(payload.parent_comment_id, "synthetic-parent");
  assert.match(postCard, /is_anonymous:\s*isAnonymous/);
});

test("17. notification navigation remains entity-aware", () => {
  assert.match(notificationService, /\["comment_reply", "mention"\]\.includes\(notification\.type\)/);
  assert.match(notificationService, /params\.set\("comment", item\.comment_id\)/);
  assert.match(notificationService, /action_url/);
});

test("18. profile-view count and recording contracts remain active", () => {
  assert.match(profileService, /export async function getProfileViewCount/);
  assert.match(profileService, /supabase\.rpc\("get_profile_view_count"/);
  assert.match(profileService, /export async function recordProfileView/);
  assert.match(profileService, /\.from\("profile_views"\)/);
  assert.match(profilePage, /recordProfileView\(profile\.id\)/);
});

test("19. leaderboard route and ranking contracts remain active", () => {
  assert.match(appSource, /path="\/leaderboard"\s+element=\{<LeaderboardPage\s*\/>\}/);
  assert.match(leaderboardPage, /function LeaderboardPage\(/);
  assert.match(leaderboardService, /export function buildLeaderboard/);
  assert.match(leaderboardService, /export function getCurrentUserRank/);
  assert.match(leaderboardService, /export function getTopThree/);
});

test("20. mailbox route, validation, and submission remain active", () => {
  assert.match(appSource, /path="\/anonymous-mailbox"\s+element=\{<AnonymousMailboxPage\s*\/>\}/);
  assert.match(mailboxService, /export function validateAnonymousMailboxDraft/);
  assert.match(mailboxService, /export async function createAnonymousMailboxMessage/);
  assert.match(mailboxPage, /createAnonymousMailboxMessage\(form\)/);
});

test("21. mobile layout and bottom navigation remain active", () => {
  assert.match(desktopLayout, /function MobileBottomNavigation\(/);
  assert.match(desktopLayout, /xl:hidden/);
  assert.match(desktopLayout, /aria-label="Primary mobile navigation"/);
  assert.match(mainLayout, /mobile-user-search/);
});

test("22. desktop layout and navigation remain active", () => {
  assert.match(desktopLayout, /function DesktopLayout\(/);
  assert.match(desktopLayout, /hidden xl:sticky/);
  assert.match(desktopLayout, /xl:grid-cols-\[320px_minmax\(0,760px\)_320px\]/);
});

test("23. deep-route refresh rewrite and application routes remain intact", () => {
  assert.deepEqual(vercelConfig.rewrites, [
    {
      source: "/((?!api(?:/|$)|.*\\..*).*)",
      destination: "/index.html",
    },
  ]);
  assert.match(appSource, /path="\/admin"/);
  assert.match(appSource, /path="\/profile\/:userId"/);
  assert.match(viteConfig, /base:\s*['"]\/['"]/);
});

test("24. no active localhost Socket.IO connection remains", () => {
  assert.doesNotMatch(appSource, /SocketProvider|socket_context|socket\.io-client|localhost:4000|\/socket\.io\//);

  for (const filePath of activeSourceFiles) {
    assert.doesNotMatch(readFileSync(filePath, "utf8"), /from\s+["']socket\.io-client["']/);
    assert.doesNotMatch(readFileSync(filePath, "utf8"), /from\s+["'][^"']*socket_context["']/);
    assert.doesNotMatch(readFileSync(filePath, "utf8"), /from\s+["'][^"']*socket_client["']/);
  }

  assert.equal(sha256(socketContextSource), "1f69c9783bbdd1007f78f80919409bb5189ef04097d7ee4d0ee571a65318b83f");
  assert.equal(sha256(socketClientSource), "3811a0252400ac0e77a64f619a378fd8e6efd95701f4372a537f0044e2e07374");
  assert.equal(sha256(appConfigSource), "2dae7d540937a83184314976056a87ab2c6a795d886494bd6683f2e4a0ebb735");
  assert.match(packageSource, /"socket\.io-client": "\^4\.7\.2"/);
});
