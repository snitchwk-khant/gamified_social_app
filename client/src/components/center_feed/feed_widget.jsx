import FeedHeader from "./feed_header";
import PostForm from "./post_form";
import FeedPanel from "./feed_panel";
import { useTheme } from "../../context/theme_context";

function formatAnnouncementDate(value) {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getCreatorName(announcement) {
  const creator = announcement.creator;
  return creator?.full_name || creator?.email || "Company";
}

function FeedWidget({
  posts,
  draft,
  onDraftChange,
  onPublish,
  onCommentCreated,
  announcements = [],
  announcementsLoading = false,
  announcementsError = "",
  onRetryAnnouncements,
  onDeletePost,
  onReactionUpdated,
  focusedPostId = "",
  focusedCommentId = "",
  shouldOpenFocusedComments = false,
}) {
  const { isDark } = useTheme();
  const visibleAnnouncements = announcements.filter((item) => {
    const hasTitle = Boolean(item?.title?.toString().trim());
    const hasBody = Boolean(item?.body?.toString().trim());

    return hasTitle || hasBody;
  });

  return (
    <div className="flex min-h-full flex-col gap-4 sm:gap-5">
      <FeedHeader title="Team feed" subtitle="Daily collaboration" />

      {announcementsLoading && visibleAnnouncements.length === 0 ? (
        <p className={`-mt-2 text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          Loading announcements...
        </p>
      ) : null}

      {!announcementsLoading && announcementsError ? (
        <div className={`-mt-2 flex items-center gap-3 text-xs ${isDark ? "text-rose-300" : "text-rose-700"}`}>
          <span>{announcementsError}</span>
          <button
            type="button"
            onClick={onRetryAnnouncements}
            className={`rounded-full border px-3 py-1 font-medium transition ${
              isDark
                ? "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
            }`}
          >
            Retry
          </button>
        </div>
      ) : null}

      {visibleAnnouncements.length > 0 ? (
        <div className="space-y-2 px-0 sm:space-y-3">
          {visibleAnnouncements.map((item) => {
            const creatorName = getCreatorName(item);

            return (
              <article
                key={item.id}
                className={`border-y px-3 py-3 sm:rounded-2xl sm:border sm:p-4 sm:shadow-[0_12px_30px_rgba(196,70,255,0.08)] ${
                  isDark
                    ? "border-fuchsia-500/25 bg-slate-900 text-slate-100"
                    : "border-fuchsia-100 bg-white text-slate-900"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c446ff]">
                      📢 Announcement
                    </p>
                    <h3 className={`mt-1 text-base font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                      {item.title || "Announcement"}
                    </h3>
                  </div>
                  <div className="text-right">
                    {item.is_pinned ? (
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c446ff]">Pinned</p>
                    ) : null}
                    <p className="mt-1 text-xs text-slate-500">{formatAnnouncementDate(item.created_at)}</p>
                  </div>
                </div>

                <p className={`mt-2 text-sm leading-6 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                  {item.body || ""}
                </p>

                <p className={`mt-3 text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Created by {creatorName}
                </p>
              </article>
            );
          })}
        </div>
      ) : null}

      <PostForm value={draft} onChange={onDraftChange} onSubmit={onPublish} />
      <FeedPanel
        posts={posts}
        onCommentCreated={onCommentCreated}
        onDeletePost={onDeletePost}
        onReactionUpdated={onReactionUpdated}
        focusedPostId={focusedPostId}
        focusedCommentId={focusedCommentId}
        shouldOpenFocusedComments={shouldOpenFocusedComments}
      />
    </div>
  );
}

export default FeedWidget;
