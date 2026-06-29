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

function sortStoriesByCreatedAt(stories) {
  return [...stories].sort(
    (leftStory, rightStory) => new Date(rightStory.created_at).getTime() - new Date(leftStory.created_at).getTime()
  );
}

function isActiveStory(story) {
  return !story?.expires_at || new Date(story.expires_at).getTime() > Date.now();
}

function upsertStoryCard(stories, nextStory) {
  if (!nextStory?.id || !isActiveStory(nextStory)) {
    return stories.filter((story) => story.id !== nextStory?.id);
  }

  const existingSameUser = stories.find(
    (story) => story.user_id === nextStory.user_id && story.id !== nextStory.id
  );

  if (
    existingSameUser &&
    new Date(existingSameUser.created_at).getTime() > new Date(nextStory.created_at).getTime()
  ) {
    return sortStoriesByCreatedAt(stories.filter((story) => story.id !== nextStory.id));
  }

  return sortStoriesByCreatedAt([
    nextStory,
    ...stories.filter((story) => story.id !== nextStory.id && story.user_id !== nextStory.user_id),
  ]);
}

function getLatestStoryCards(stories) {
  return sortStoriesByCreatedAt(stories).reduce((latestStories, story) => {
    if (!story?.user_id) {
      return [...latestStories, story];
    }

    if (latestStories.some((item) => item.user_id === story.user_id)) {
      return latestStories;
    }

    return [...latestStories, story];
  }, []);
}

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
      setStories(getLatestStoryCards(formatted));
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
    if (!user?.id) {
      return;
    }

    const avatarUrl = user.avatar_url || null;

    setPosts((prevPosts) =>
      prevPosts.map((post) => {
        if (post.user_id !== user.id) {
          return post;
        }

        return {
          ...post,
          author_avatar: avatarUrl,
          profile: post.profile
            ? {
                ...post.profile,
                avatar_url: avatarUrl,
              }
            : post.profile,
        };
      })
    );

    setStories((prevStories) =>
      prevStories.map((story) => {
        if (story.user_id !== user.id) {
          return story;
        }

        return {
          ...story,
          author_avatar: avatarUrl,
          profile: story.profile
            ? {
                ...story.profile,
                avatar_url: avatarUrl,
              }
            : story.profile,
        };
      })
    );
  }, [user?.avatar_url, user?.id]);

  useEffect(() => {
    loadPosts();
    loadAnnouncements();
    loadStories();

    const unsubscribe = postService.subscribeToPosts(() => {
      loadPosts();
    });

    const unsubscribeStories = storiesService.subscribeToStories((payload) => {
      if (!payload?.eventType) {
        return;
      }

      if (payload.eventType === "DELETE") {
        const deletedStoryId = payload.old?.id;

        if (!deletedStoryId) {
          return;
        }

        setStories((prevStories) => prevStories.filter((story) => story.id !== deletedStoryId));
        return;
      }

      if (!payload.new?.id) {
        return;
      }

      const immediateStory = storiesService.formatStoryRow(payload.new);
      setStories((prevStories) => upsertStoryCard(prevStories, immediateStory));

      storiesService
        .formatRealtimeStory(payload.new)
        .then((nextStory) => {
          if (!nextStory) {
            return;
          }

          setStories((prevStories) => upsertStoryCard(prevStories, nextStory));
        })
        .catch((err) => {
          console.error("Story realtime format error:", err);
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

  const handleDeleteStory = async (storyId) => {
    if (!storyId) {
      return;
    }

    setStoriesError("");

    const { error } = await storiesService.deleteStory(storyId);

    if (error) {
      setStoriesError(error?.message || "Unable to delete story.");
    }
  };

  const handlePublish = async (content, isAnonymous = false, imageFile = null) => {
    const trimmedContent = content?.trim();
    if (!trimmedContent && !imageFile) {
      return { success: false, error: "Write something or add an image to publish." };
    }

    const { error } = await postService.createPost({
      content: trimmedContent,
      imageFile,
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
      return { success: false, error: error?.message || "Unable to publish post." };
    }

    setDraft("");
    await loadPosts();
    return { success: true };
  };

  const handleDeletePost = useCallback(
    async (postId, imageUrl = "") => {
      const { error } = await postService.deletePost(postId, imageUrl);

      if (error) {
        console.error("Delete Post Error:", error);
        return false;
      }

      setPosts((prevPosts) => prevPosts.filter((post) => post.id !== postId));
      return true;
    },
    []
  );

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
            const isStoryOwner = Boolean(user?.id && story.user_id === user.id);

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

                  {isStoryOwner ? (
                    <button
                      type="button"
                      aria-label="Delete story"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleDeleteStory(story.id);
                      }}
                      className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                    >
                      Delete
                    </button>
                  ) : null}
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
        onDeletePost={handleDeletePost}
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
