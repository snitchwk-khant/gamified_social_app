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

function parseMetadata(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "object") {
    return value;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  return null;
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
}) {
  const { isDark } = useTheme();
  const visibleAnnouncements = announcements.filter((item) => {
    const meta = parseMetadata(item?.metadata);
    const imageUrl =
      item?.image_url || item?.image || item?.banner_url || meta?.image_url || meta?.image || null;
    const hasTitle = Boolean(item?.title?.toString().trim());
    const hasBody = Boolean(item?.body?.toString().trim());

    return hasTitle || hasBody || Boolean(imageUrl);
  });

  return (
    <div className="flex min-h-full flex-col gap-6">
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
        <div className="space-y-3">
          {visibleAnnouncements.map((item) => {
            const meta = parseMetadata(item.metadata);
            const priority = (item.priority || meta?.priority || "normal").toString().toUpperCase();
            const imageUrl =
              item.image_url || item.image || item.banner_url || meta?.image_url || meta?.image || null;

            return (
              <article
                key={item.id}
                className={`rounded-2xl border p-4 ${
                  isDark
                    ? "border-slate-800 bg-slate-900 text-slate-100"
                    : "border-slate-200 bg-white text-slate-900"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">HR announcement</p>
                    <h3 className={`mt-1 text-base font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                      {item.title || "Announcement"}
                    </h3>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{priority}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatAnnouncementDate(item.created_at)}</p>
                  </div>
                </div>

                <p className={`mt-2 text-sm leading-6 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                  {item.body || ""}
                </p>

                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={item.title || "Announcement image"}
                    className="mt-3 max-h-64 w-full rounded-xl border border-slate-200 object-cover"
                  />
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}

      <PostForm value={draft} onChange={onDraftChange} onSubmit={onPublish} />
      <FeedPanel posts={posts} onCommentCreated={onCommentCreated} onDeletePost={onDeletePost} />
    </div>
  );
}

export default FeedWidget;
