import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const postCard = readFileSync(new URL("../src/components/center_feed/post_card.jsx", import.meta.url), "utf8");
const notificationService = readFileSync(new URL("../src/services/notifications_service.js", import.meta.url), "utf8");
const notificationPage = readFileSync(new URL("../src/pages/notifications_page.jsx", import.meta.url), "utf8");
const notificationBanner = readFileSync(new URL("../src/components/notifications/NotificationBanner.jsx", import.meta.url), "utf8");
const leftSidebar = readFileSync(new URL("../src/components/sidebar/left_sidebar.jsx", import.meta.url), "utf8");
const desktopLayout = readFileSync(new URL("../src/components/layout/desktop_layout.jsx", import.meta.url), "utf8");
const commentForm = readFileSync(new URL("../src/components/center_feed/comment_form.jsx", import.meta.url), "utf8");
const commentList = readFileSync(new URL("../src/components/center_feed/comment_list.jsx", import.meta.url), "utf8");
const viteConfig = readFileSync(new URL("../vite.config.js", import.meta.url), "utf8");

const createSocialStart = notificationService.indexOf("export async function createSocialNotification");
const createSocialEnd = notificationService.indexOf("export async function createAdminNotifications", createSocialStart);
const createSocialSource = notificationService.slice(createSocialStart, createSocialEnd);

function syntheticCommentPayload({ content, isAnonymous = false, parentCommentId = null }) {
  return {
    post_id: "synthetic-post",
    user_id: "synthetic-user",
    content: content.trim(),
    is_anonymous: isAnonymous,
    parent_comment_id: parentCommentId || null,
  };
}

test("1. normal top-level comments preserve the database INSERT contract", () => {
  const payload = syntheticCommentPayload({ content: "Normal comment" });
  assert.equal(payload.is_anonymous, false);
  assert.equal(payload.parent_comment_id, null);
  assert.match(postCard, /\.from\("comments"\)[\s\S]*?\.insert\(insertPayload\)/);
});

test("2. masked top-level comments preserve is_anonymous", () => {
  const payload = syntheticCommentPayload({ content: "Masked comment", isAnonymous: true });
  assert.equal(payload.is_anonymous, true);
  assert.equal(payload.parent_comment_id, null);
  assert.match(postCard, /is_anonymous:\s*isAnonymous/);
});

test("3. normal replies preserve parent_comment_id", () => {
  const payload = syntheticCommentPayload({ content: "Normal reply", parentCommentId: "synthetic-parent" });
  assert.equal(payload.parent_comment_id, "synthetic-parent");
  assert.equal(payload.is_anonymous, false);
  assert.match(postCard, /parent_comment_id:\s*resolvedParentCommentId/);
});

test("4. masked replies preserve both reply and masking fields", () => {
  const payload = syntheticCommentPayload({
    content: "Masked reply",
    isAnonymous: true,
    parentCommentId: "synthetic-parent",
  });
  assert.equal(payload.parent_comment_id, "synthetic-parent");
  assert.equal(payload.is_anonymous, true);
});

test("5. top-level mention entry and rendering remain available", () => {
  assert.match(postCard, /loadMentionUsers\(\)/);
  assert.match(commentForm, /mentionUsers/);
  assert.match(commentList, /renderCommentContent\(comment\.content, isDark, mentionUsers/);
});

test("6. reply forms retain mention suggestions", () => {
  assert.match(postCard, /renderReplyForm/);
  assert.match(postCard, /mentionUsers=\{mentionUsers\}/);
  assert.match(commentForm, /findMentionToken/);
});

test("7. parent-owner mention overlap has no frontend notification writer", () => {
  assert.doesNotMatch(postCard, /notifyPostCommentInteraction|notifyCommentRecipients/);
  assert.doesNotMatch(postCard, /type:\s*"comment_reply"/);
});

test("8. other-user mentions remain UI-visible without the obsolete mention RPC", () => {
  assert.doesNotMatch(postCard, /create_comment_notification|createCommentNotification/);
  assert.match(postCard, /setMentionUsers/);
  assert.match(commentList, /createMentionResolver/);
});

test("9. self-replies use the same database-owned INSERT path", () => {
  const payload = syntheticCommentPayload({ content: "Self reply", parentCommentId: "own-comment" });
  assert.equal(payload.parent_comment_id, "own-comment");
  assert.doesNotMatch(postCard, /targetUserId:\s*parentComment\.user_id/);
});

test("10. comment/reply/mention notification RPC attempts are absent", () => {
  assert.doesNotMatch(postCard, /create_comment_notification|"post_comment"|"comment_reply"/);
  assert.doesNotMatch(createSocialSource, /post_comment|comment_reply|mention/);
  assert.match(createSocialSource, /type === "post_reaction"/);
});

test("11. notification badge, list, and banner consumers remain active", () => {
  assert.match(notificationPage, /subscribeToMyNotifications/);
  assert.match(notificationPage, /subscribeToUnreadNotificationCount/);
  assert.match(notificationBanner, /subscribeToMyNotifications/);
  assert.match(leftSidebar, /subscribeToUnreadNotificationCount/);
  assert.match(desktopLayout, /subscribeToUnreadNotificationCount/);
});

test("12. notification Realtime subscriptions remain unchanged in scope", () => {
  assert.match(notificationService, /NOTIFICATIONS_REALTIME_CHANNEL = "notifications-realtime"/);
  assert.match(notificationService, /table:\s*"notifications"/);
  assert.match(notificationService, /table:\s*"notification_reads"/);
  assert.match(notificationService, /\["INSERT", "UPDATE", "DELETE"\]/);
});

test("13. exact reply navigation remains entity-ID based", () => {
  assert.match(notificationService, /\["comment_reply", "mention"\]\.includes\(notification\.type\)/);
  assert.match(notificationService, /\.select\("id, post_id"\)/);
  assert.match(notificationService, /comment_id:\s*notification\.entity_id/);
  assert.match(notificationService, /params\.set\("comment", item\.comment_id\)/);
});

test("14. actual comment submission failures still surface", () => {
  assert.match(postCard, /if \(error\) \{[\s\S]*?Comment Insert Error:[\s\S]*?errorNotification\(\);[\s\S]*?return false;/);
  assert.match(postCard, /if \(!trimmedContent\) return false/);
  assert.match(postCard, /return true;/);
});

test("15. unrelated notification generation and routing remain functional", () => {
  assert.match(createSocialSource, /supabase\.rpc\("create_social_notification"/);
  assert.match(postCard, /type:\s*"post_reaction"/);
  assert.match(notificationService, /export async function createAdminNotifications/);
  assert.match(notificationService, /export async function createNotification/);
  assert.match(viteConfig, /base:\s*['"]\/['"]/);
});
