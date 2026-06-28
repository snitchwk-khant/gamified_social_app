import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "../context/auth_context";
import * as postService from "../services/post_service";
import * as storiesService from "../services/stories_service";
import { getPinnedActiveAnnouncementsResult } from "../services/announcements_service";
import { getFeatureFlags } from "../services/admin_configs_service";
import FeedWidget from "../components/center_feed/feed_widget";
import { useTheme } from "../context/theme_context";

function HomePage() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const storyInputRef = useRef(null);

  const [draft, setDraft] = useState("");
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [announcementsError, setAnnouncementsError] = useState("");
  const [announcementsEnabled, setAnnouncementsEnabled] = useState(true);
  const [storiesLoading, setStoriesLoading] = useState(false);
  const [storiesError, setStoriesError] = useState("");
  const [storyUploading, setStoryUploading] = useState(false);

  const loadStories = useCallback(async () => {
    setStoriesLoading(true);
    setStoriesError("");

    try {
      const formatted = await storiesService.getStories();
      setStories(formatted);
    } catch (err) {
      console.error("Load Stories Error:", err);
      setStories([]);
      setStoriesError("Unable to load stories.");
    } finally {
      setStoriesLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    getFeatureFlags().then((flags) => {
      if (!isMounted) {
        return;
      }

      setAnnouncementsEnabled(flags.announcements_enabled !== false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const loadPosts = useCallback(async () => {
    try {
      const formatted = await postService.getPosts();
      console.log("Posts Loaded:", formatted);
      setPosts(formatted);
    } catch (err) {
      console.error("Load Posts Error:", err);
    }
  }, []);

  const loadAnnouncements = useCallback(async () => {
    if (!announcementsEnabled) {
      setAnnouncements([]);
      setAnnouncementsError("");
      setAnnouncementsLoading(false);
      return;
    }

    setAnnouncementsLoading(true);
    setAnnouncementsError("");

    const role = user?.role?.toString().trim().toLowerCase() || null;
    const { data, error } = await getPinnedActiveAnnouncementsResult({ role });

    if (error) {
      setAnnouncements([]);
      setAnnouncementsError("Unable to load announcements.");
      setAnnouncementsLoading(false);
      return;
    }

    setAnnouncements(data || []);
    setAnnouncementsLoading(false);
  }, [announcementsEnabled, user?.role]);

  useEffect(() => {
    loadPosts();
    loadAnnouncements();
    loadStories();

    const unsubscribe = postService.subscribeToPosts((payload) => {
      console.log("🔥 Realtime Payload:", payload);
      loadPosts();
    });

    const unsubscribeStories = storiesService.subscribeToStories(() => {
      loadStories();
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
      if (typeof unsubscribeStories === "function") unsubscribeStories();
    };
  }, [loadAnnouncements, loadPosts, loadStories]);

  const handleOpenStoryPicker = () => {
    storyInputRef.current?.click();
  };

  const handleStoryFileChange = async (event) => {
    const input = event.currentTarget;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    setStoryUploading(true);
    setStoriesError("");

    try {
      const { data: uploadData, error: uploadError } = await storiesService.uploadStoryImage(file);

      if (uploadError || !uploadData?.publicUrl) {
        throw uploadError || new Error("Unable to upload story image.");
      }

      const { error: createError } = await storiesService.createStory({
        image_url: uploadData.publicUrl,
      });

      if (createError) {
        throw createError;
      }

      await loadStories();
    } catch (err) {
      console.error("Create Story Error:", err);
      setStoriesError(err?.message || "Unable to save story.");
    } finally {
      input.value = "";
      setStoryUploading(false);
    }
  };

  const handlePublish = async (content, isAnonymous = false) => {
    const trimmedContent = content?.trim();
    if (!trimmedContent) return false;

    const { error } = await postService.createPost({
      content: trimmedContent,
      isAnonymous,
    });

    if (error) {
      console.error("Publish Post Error:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        error,
      });
      return false;
    }

    setDraft("");
    await loadPosts();
    return true;
  };

  return (
    <div className="flex h-full min-h-[calc(100vh-64px)] flex-col">
      <section
        className={`mb-6 rounded-2xl border p-4 sm:p-5 ${
          isDark ? "border-slate-800 bg-slate-950/90" : "border-slate-200 bg-white"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Stories</p>
            <h2 className={`mt-1 text-xl font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
              My Day
            </h2>
          </div>
          <div className={`text-right text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            <p>{storiesLoading ? "Refreshing stories..." : `${stories.length} ${stories.length === 1 ? "story" : "stories"}`}</p>
            <p className="mt-1">Tap a card to add yours</p>
          </div>
        </div>

        {storiesError ? (
          <p className={`mt-3 text-sm ${isDark ? "text-rose-300" : "text-rose-700"}`}>{storiesError}</p>
        ) : null}

        <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={handleOpenStoryPicker}
            disabled={storyUploading}
            className={`group relative flex w-[170px] shrink-0 flex-col overflow-hidden rounded-[1.75rem] border text-left transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70 ${
              isDark
                ? "border-dashed border-slate-700 bg-slate-900/80 text-slate-100 hover:border-slate-500"
                : "border-dashed border-slate-300 bg-slate-50 text-slate-900 hover:border-slate-400"
            }`}
          >
            <div className="flex min-h-[220px] flex-1 flex-col justify-between p-4">
              <div className="flex items-center justify-between">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-full border text-lg font-semibold ${
                    isDark ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-300 bg-white text-slate-700"
                  }`}
                >
                  {storyUploading ? "..." : "+"}
                </div>
                <span className={`text-[10px] uppercase tracking-[0.24em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  {storyUploading ? "Uploading" : "My Story"}
                </span>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">Share a moment</p>
                <p className={`text-xs leading-5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Pick an image and add it to the top of the feed.
                </p>
              </div>

              <div
                className={`h-28 rounded-2xl border border-dashed ${
                  isDark ? "border-slate-700 bg-slate-950/70" : "border-slate-300 bg-white"
                }`}
              />
            </div>
          </button>

          {stories.map((story) => {
            const initials = story.author_name
              ? story.author_name
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase())
                  .join("")
              : "U";

            return (
              <article
                key={story.id}
                className={`flex w-[170px] shrink-0 flex-col overflow-hidden rounded-[1.75rem] border ${
                  isDark ? "border-slate-800 bg-slate-900 text-slate-100" : "border-slate-200 bg-white text-slate-900"
                }`}
              >
                <div className="flex items-center gap-3 px-4 pt-4">
                  {story.author_avatar ? (
                    <img
                      src={story.author_avatar}
                      alt={story.author_name}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold ${
                        isDark ? "bg-slate-800 text-slate-100" : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {initials || "U"}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{story.author_name}</p>
                    <p className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                      {story.created_at_label}
                    </p>
                  </div>
                </div>

                <div className="px-4 pb-4 pt-3">
                  <div className="overflow-hidden rounded-2xl">
                    {story.image_url ? (
                      <img
                        src={story.image_url}
                        alt={`${story.author_name}'s story`}
                        className="h-40 w-full object-cover"
                      />
                    ) : (
                      <div
                        className={`flex h-40 w-full items-center justify-center text-sm ${
                          isDark ? "bg-slate-950 text-slate-400" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        No image
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <input
          ref={storyInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleStoryFileChange}
        />
      </section>

      <FeedWidget
        posts={posts}
        draft={draft}
        onDraftChange={setDraft}
        onPublish={handlePublish}
        announcements={announcementsEnabled ? announcements : []}
        announcementsLoading={announcementsEnabled ? announcementsLoading : false}
        announcementsError={announcementsEnabled ? announcementsError : ""}
        onRetryAnnouncements={loadAnnouncements}
      />
    </div>
  );
}

export default HomePage;