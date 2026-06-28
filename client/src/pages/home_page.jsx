import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/auth_context";
import * as postService from "../services/post_service";
import * as storiesService from "../services/stories_service";
import { getPinnedActiveAnnouncementsResult } from "../services/announcements_service";
import { getFeatureFlags } from "../services/admin_configs_service";
import FeedWidget from "../components/center_feed/feed_widget";
import StoryViewer from "../components/story/story_viewer";
import { useTheme } from "../context/theme_context";
import { supabase } from "../lib/supabase";

function HomePage() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const storyInputRef = useRef(null);
  const storiesRequestRef = useRef(0);

  const [draft, setDraft] = useState("");
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [announcementsError, setAnnouncementsError] = useState("");
  const [announcementsEnabled, setAnnouncementsEnabled] = useState(true);
  const [, setStoriesLoading] = useState(false);
  const [storiesError, setStoriesError] = useState("");
  const [storyUploading, setStoryUploading] = useState(false);
  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [storyViewerIndex, setStoryViewerIndex] = useState(0);

  const loadStories = useCallback(async () => {
    const requestId = storiesRequestRef.current + 1;
    storiesRequestRef.current = requestId;

    setStoriesLoading(true);
    setStoriesError("");

    try {
      const formatted = await storiesService.getStories();
      if (storiesRequestRef.current !== requestId) {
        return;
      }
      setStories(formatted);
    } catch (err) {
      if (storiesRequestRef.current !== requestId) {
        return;
      }
      console.error("Load Stories Error:", err);
      setStories([]);
      setStoriesError("Unable to load stories.");
    } finally {
      if (storiesRequestRef.current === requestId) {
        setStoriesLoading(false);
      }
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

    const unsubscribe = postService.subscribeToPosts(() => {
      loadPosts();
    });

    const unsubscribeStories = storiesService.subscribeToStories((payload) => {
      if (!payload?.new?.id) {
        return;
      }

      if (payload.eventType === "INSERT" && payload.new.user_id === user?.id) {
        return;
      }

      setStories((prevStories) => {
        const existingIndex = prevStories.findIndex((story) => story.id === payload.new.id);

        if (payload.eventType === "INSERT" && existingIndex !== -1) {
          return prevStories;
        }

        const nextStory = {
          id: payload.new.id,
          user_id: payload.new.user_id || null,
          author_name: payload.new.author_name || payload.new.profile?.full_name || payload.new.user_id || "",
          author_avatar: payload.new.author_avatar || payload.new.profile?.avatar_url || null,
          profile: payload.new.profile
            ? {
                id: payload.new.profile.id || payload.new.user_id || null,
                full_name: payload.new.profile.full_name || payload.new.author_name || "",
                avatar_url: payload.new.profile.avatar_url || null,
              }
            : null,
          image_url: payload.new.image_url || payload.new.media_url || null,
          content: payload.new.content || payload.new.caption || "",
          created_at: payload.new.created_at || new Date().toISOString(),
          created_at_label: payload.new.created_at
            ? new Date(payload.new.created_at).toLocaleString()
            : new Date().toLocaleString(),
          expires_at: payload.new.expires_at || null,
          updated_at: payload.new.updated_at || payload.new.created_at || new Date().toISOString(),
        };

        if (existingIndex !== -1) {
          const updatedStories = [...prevStories];
          updatedStories[existingIndex] = nextStory;
          return updatedStories.sort(
            (leftStory, rightStory) => new Date(rightStory.created_at).getTime() - new Date(leftStory.created_at).getTime()
          );
        }

        return [nextStory, ...prevStories].sort(
          (leftStory, rightStory) => new Date(rightStory.created_at).getTime() - new Date(leftStory.created_at).getTime()
        );
      });
    });

    const commentsChannel = supabase
      .channel("comments-post-counts")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
        },
        () => {
          loadPosts();
        }
      )
      .subscribe();

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
      if (typeof unsubscribeStories === "function") unsubscribeStories();
      supabase.removeChannel(commentsChannel);
    };
  }, [loadAnnouncements, loadPosts, loadStories, user?.id]);

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

  const handleOpenStoryViewer = (index) => {
    setStoryViewerIndex(index);
    setStoryViewerOpen(true);
  };

  const handleCloseStoryViewer = () => {
    setStoryViewerOpen(false);
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

  const handlePostCommentCreated = useCallback((postId) => {
    if (!postId) {
      return;
    }

    setPosts((prevPosts) =>
      prevPosts.map((post) => {
        if (post.id !== postId) {
          return post;
        }

        return {
          ...post,
          comments_count: Number(post.comments_count || 0) + 1,
        };
      })
    );
  }, []);

  return (
    <div className="flex h-full min-h-[calc(100vh-64px)] flex-col">
      <section
        className={`mb-6 rounded-[1.5rem] border p-4 sm:p-5 ${
          isDark ? "border-slate-800 bg-slate-950/90" : "border-slate-200 bg-white"
        }`}
      >
        {storiesError ? (
          <p className={`mb-3 text-sm ${isDark ? "text-rose-300" : "text-rose-700"}`}>{storiesError}</p>
        ) : null}

        <div className="flex gap-5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={handleOpenStoryPicker}
            disabled={storyUploading}
            className="group flex w-[230px] shrink-0 flex-col rounded-[1.625rem] border border-dashed border-slate-300 bg-white p-5 text-left transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <div className="flex min-h-[252px] flex-1 flex-col">
              <div className="flex items-center gap-4">
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-[30px] font-light leading-none text-slate-900"
                >
                  +
                </div>
                <span className="text-xs font-medium uppercase tracking-[0.42em] text-[#c446ff]">
                  MY STORY
                </span>
              </div>

              <div className="mt-5 aspect-square w-full rounded-[18px] border border-dashed border-slate-300 bg-white" />
            </div>
          </button>

          {stories.map((story, index) => {
            const fullName = story.profile?.full_name || story.author_name || "";
            const avatarUrl = story.profile?.avatar_url ?? story.author_avatar ?? null;
            const initials = fullName
              ? fullName
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase())
                  .join("")
              : "";

            const profilePath = story.user_id ? `/profile/${story.user_id}` : null;

            return (
              <article
                key={story.id}
                className="flex w-[230px] shrink-0 flex-col rounded-[1.5rem] border border-slate-200 bg-white p-5 text-slate-900 shadow-[0_14px_30px_rgba(15,23,42,0.06)]"
              >
                <div className="flex items-center gap-3.5">
                  {profilePath ? (
                    <Link to={profilePath} aria-label={`Open ${fullName || "user"} profile`} className="shrink-0">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={fullName || "Story avatar"}
                          className="h-11 w-11 rounded-full object-cover"
                        />
                      ) : (
                        <div
                          className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700"
                        >
                          {initials || "U"}
                        </div>
                      )}
                    </Link>
                  ) : avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={fullName || "Story avatar"}
                      className="h-11 w-11 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700"
                    >
                      {initials || "U"}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    {profilePath ? (
                      <Link
                        to={profilePath}
                        className="block truncate text-sm font-bold text-slate-900 transition hover:text-slate-700"
                      >
                        {fullName}
                      </Link>
                    ) : (
                      <p className="truncate text-sm font-bold text-slate-900">{fullName}</p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenStoryViewer(index)}
                  className="mt-[18px] block text-left"
                >
                  <div className="overflow-hidden rounded-[18px]">
                    {story.image_url ? (
                      <img
                        src={story.image_url}
                        alt={`${fullName || "Story"}'s story`}
                        className="aspect-square w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-square w-full items-center justify-center bg-slate-100 text-sm text-slate-500">
                        No image
                      </div>
                    )}
                  </div>
                </button>
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
        onCommentCreated={handlePostCommentCreated}
        announcements={announcementsEnabled ? announcements : []}
        announcementsLoading={announcementsEnabled ? announcementsLoading : false}
        announcementsError={announcementsEnabled ? announcementsError : ""}
        onRetryAnnouncements={loadAnnouncements}
      />

      <StoryViewer
        isOpen={storyViewerOpen}
        stories={stories}
        initialIndex={storyViewerIndex}
        onClose={handleCloseStoryViewer}
      />
    </div>
  );
}

export default HomePage;
