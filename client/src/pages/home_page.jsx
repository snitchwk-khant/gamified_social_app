import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/auth_context";
import * as postService from "../services/post_service";
import * as storiesService from "../services/stories_service";
import { getActiveAnnouncements } from "../services/announcement_service";
import { errorNotification, mediumImpact } from "../services/haptics";
import NetworkService from "../services/network_service";
import FeedWidget from "../components/center_feed/feed_widget";
import StoryViewer from "../components/story/story_viewer";
import { useTheme } from "../context/theme_context";
import { supabase } from "../lib/supabase";
import { getProfilePath } from "../utils/profile_path";

const STORY_CARD_STEP_PX = 250;
const STORY_TEXT_MAX_LENGTH = 300;
const SOCIAL_FEED_REALTIME_EVENT = "social-feed-realtime";
const STORY_BACKGROUND_OPTIONS = [
  {
    id: "purple",
    label: "Purple Gradient",
    className: "from-fuchsia-500 via-purple-600 to-violet-700",
  },
  {
    id: "pink",
    label: "Pink Gradient",
    className: "from-rose-400 via-fuchsia-500 to-pink-700",
  },
  {
    id: "blue",
    label: "Blue Gradient",
    className: "from-sky-400 via-blue-600 to-indigo-800",
  },
  {
    id: "orange",
    label: "Orange Gradient",
    className: "from-amber-300 via-orange-500 to-rose-600",
  },
  {
    id: "green",
    label: "Green Gradient",
    className: "from-emerald-300 via-green-500 to-teal-800",
  },
  {
    id: "dark",
    label: "Dark Gradient",
    className: "from-slate-900 via-purple-950 to-black",
  },
];

function getStoryBackgroundClass(backgroundId) {
  return (
    STORY_BACKGROUND_OPTIONS.find((background) => background.id === backgroundId)?.className ||
    STORY_BACKGROUND_OPTIONS[0].className
  );
}

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

  const existingStory = stories.find((story) => story.id === nextStory.id);
  const storyToStore = {
    ...nextStory,
    view_count: Number(nextStory.view_count ?? existingStory?.view_count ?? 0),
  };

  const existingSameUser = stories.find(
    (story) => story.user_id === storyToStore.user_id && story.id !== storyToStore.id
  );

  if (
    existingSameUser &&
    new Date(existingSameUser.created_at).getTime() > new Date(storyToStore.created_at).getTime()
  ) {
    return sortStoriesByCreatedAt(stories.filter((story) => story.id !== storyToStore.id));
  }

  return sortStoriesByCreatedAt([
    storyToStore,
    ...stories.filter((story) => story.id !== storyToStore.id && story.user_id !== storyToStore.user_id),
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
  const location = useLocation();
  const storyInputRef = useRef(null);
  const storiesRequestRef = useRef(0);
  const focusedPostId = useMemo(() => new URLSearchParams(location.search).get("post") || "", [location.search]);
  const focusedCommentId = useMemo(() => new URLSearchParams(location.search).get("comment") || "", [location.search]);
  const shouldOpenFocusedComments = useMemo(() => new URLSearchParams(location.search).get("comments") === "1", [location.search]);

  const [draft, setDraft] = useState("");
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [announcementsError, setAnnouncementsError] = useState("");
  const [, setStoriesLoading] = useState(false);
  const [storiesError, setStoriesError] = useState("");
  const [storyUploading, setStoryUploading] = useState(false);
  const [storyComposerOpen, setStoryComposerOpen] = useState(false);
  const [storyComposerMode, setStoryComposerMode] = useState("text");
  const [storyText, setStoryText] = useState("");
  const [storyBackground, setStoryBackground] = useState("purple");
  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [storyViewerIndex, setStoryViewerIndex] = useState(0);
  const [storyViewerStoryId, setStoryViewerStoryId] = useState(null);
  const [storyViewerSession, setStoryViewerSession] = useState(0);
  const [storyRailIndex, setStoryRailIndex] = useState(0);
  const myActiveStory = useMemo(
    () => (user?.id ? stories.find((story) => story.user_id === user.id) || null : null),
    [stories, user?.id]
  );
  const visibleStories = useMemo(
    () => (user?.id ? stories.filter((story) => story.user_id !== user.id) : stories),
    [stories, user?.id]
  );
  const storyRailMaxIndex = visibleStories.length;

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

  const loadPosts = useCallback(async () => {
    try {
      const formatted = await postService.getPosts();
      setPosts(formatted);
    } catch (err) {
      console.error("Load Posts Error:", err);
    }
  }, []);

  const loadAnnouncements = useCallback(async () => {
    setAnnouncementsLoading(true);
    setAnnouncementsError("");

    try {
      const rows = await getActiveAnnouncements();
      setAnnouncements(rows);
    } catch (err) {
      console.error("Load Announcements Error:", err);
      setAnnouncements([]);
      setAnnouncementsError("Unable to load announcements.");
    } finally {
      setAnnouncementsLoading(false);
    }
  }, []);

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
    console.log("STATE UPDATED", { source: "home_comment_count_optimistic", postId });
  }, []);

  const handlePostReactionUpdated = useCallback((postId, summary) => {
    if (!postId || !summary) {
      return;
    }

    setPosts((prevPosts) =>
      prevPosts.map((post) => {
        if (post.id !== postId) {
          return post;
        }

        return {
          ...post,
          reaction_counts: summary.reaction_counts ?? post.reaction_counts,
          reactions_count: Number(summary.reactions_count ?? summary.like_count ?? post.reactions_count ?? 0),
          like_count: Number(summary.like_count ?? summary.reactions_count ?? post.like_count ?? 0),
          user_reaction: summary.user_reaction ?? null,
        };
      })
    );
    console.log("STATE UPDATED", { source: "home_reaction_summary", postId });
  }, []);

  useEffect(() => {
    loadPosts();
    loadAnnouncements();
    loadStories();

    const socialChannel = supabase
      .channel("home-social-feed-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "posts",
        },
        () => {
          loadPosts();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "post_reactions",
        },
        async (payload) => {
          console.log("REALTIME EVENT", {
            channel: "home-social-feed-realtime",
            table: "post_reactions",
            eventType: payload?.eventType,
          });

          const postId = payload?.new?.post_id || payload?.old?.post_id;

          if (!postId) {
            return;
          }

          const summary = await postService.getPostReactionSummary(postId);
          handlePostReactionUpdated(postId, summary);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
        },
        (payload) => {
          console.log("REALTIME EVENT", {
            channel: "home-social-feed-realtime",
            table: "comments",
            eventType: payload?.eventType,
          });

          const postId = payload?.new?.post_id || payload?.old?.post_id;

          if (!postId) {
            return;
          }

          window.dispatchEvent(new CustomEvent(SOCIAL_FEED_REALTIME_EVENT, { detail: payload }));
          loadPosts();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("SUBSCRIBED", { channel: "home-social-feed-realtime" });
        }
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

    const unsubscribeStoryViews = storiesService.subscribeToStoryViews((payload) => {
      const storyId = payload?.new?.story_id;

      if (!storyId) {
        return;
      }

      storiesService.getStoryViewCount(storyId).then((viewCount) => {
        setStories((prevStories) =>
          prevStories.map((story) => {
            if (story.id !== storyId || story.user_id !== user?.id) {
              return story;
            }

            return {
              ...story,
              view_count: viewCount,
            };
          })
        );
      });
    });

    return () => {
      supabase.removeChannel(socialChannel);
      if (typeof unsubscribeStories === "function") unsubscribeStories();
      if (typeof unsubscribeStoryViews === "function") unsubscribeStoryViews();
    };
  }, [handlePostReactionUpdated, loadAnnouncements, loadPosts, loadStories, user?.id]);

  useEffect(() => {
    setStoryRailIndex((currentIndex) => Math.min(currentIndex, storyRailMaxIndex));
  }, [storyRailMaxIndex]);

  const handleOpenStoryComposer = () => {
    setStoryComposerOpen(true);
    setStoriesError("");
  };

  useEffect(() => {
    const openStoryComposer = () => {
      window.sessionStorage.removeItem("openStoryComposer");
      setStoryComposerOpen(true);
      setStoriesError("");
    };

    if (window.sessionStorage.getItem("openStoryComposer") === "true") {
      openStoryComposer();
    }

    window.addEventListener("gemify:open-story-composer", openStoryComposer);

    return () => {
      window.removeEventListener("gemify:open-story-composer", openStoryComposer);
    };
  }, []);

  const handleCloseStoryComposer = () => {
    if (storyUploading) {
      return;
    }

    setStoryComposerOpen(false);
  };

  const handleOpenStoryFilePicker = () => {
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
      const { data: uploadData, error: uploadError } = await NetworkService.enqueue(() =>
        storiesService.uploadStoryImage(file)
      );

      if (uploadError || !uploadData?.publicUrl) {
        throw uploadError || new Error("Unable to upload story image.");
      }

      const { error: createError } = await NetworkService.enqueue(() =>
        storiesService.createStory({
          image_url: uploadData.publicUrl,
          media_type: uploadData.mediaType || "image",
          story_type: uploadData.mediaType || "image",
        })
      );

      if (createError) {
        throw createError;
      }

      setStoryComposerOpen(false);
      mediumImpact();
    } catch (err) {
      console.error("Create Story Error:", err);
      errorNotification();
      setStoriesError(err?.message || "Unable to save story.");
    } finally {
      input.value = "";
      setStoryUploading(false);
    }
  };

  const handleCreateTextStory = async () => {
    const trimmedText = storyText.trim();

    if (!trimmedText) {
      setStoriesError("Write something for your story.");
      return;
    }

    if (trimmedText.length > STORY_TEXT_MAX_LENGTH) {
      setStoriesError("Text stories must be 300 characters or less.");
      return;
    }

    setStoryUploading(true);
    setStoriesError("");

    try {
      const { error } = await NetworkService.enqueue(() =>
        storiesService.createStory({
          story_type: "text",
          background_color: storyBackground,
          content: trimmedText,
        })
      );

      if (error) {
        throw error;
      }

      setStoryText("");
      setStoryBackground("purple");
      setStoryComposerOpen(false);
      mediumImpact();
    } catch (err) {
      console.error("Create Text Story Error:", err);
      errorNotification();
      setStoriesError(err?.message || "Unable to save story.");
    } finally {
      setStoryUploading(false);
    }
  };

  const handleOpenStoryViewer = (index, storyId = null) => {
    setStoryViewerIndex(index);
    setStoryViewerStoryId(storyId);
    setStoryViewerSession((currentSession) => currentSession + 1);
    setStoryViewerOpen(true);
  };

  const handleOpenMyStory = () => {
    if (!myActiveStory) {
      handleOpenStoryComposer();
      return;
    }

    const storyIndex = stories.findIndex((story) => story.id === myActiveStory.id);
    handleOpenStoryViewer(Math.max(storyIndex, 0), myActiveStory.id);
  };

  const handlePreviousStoryCard = () => {
    setStoryRailIndex((currentIndex) => Math.max(currentIndex - 1, 0));
  };

  const handleNextStoryCard = () => {
    setStoryRailIndex((currentIndex) => Math.min(currentIndex + 1, storyRailMaxIndex));
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
    const hasMedia = Array.isArray(imageFile) ? imageFile.length > 0 : Boolean(imageFile);
    if (!trimmedContent && !hasMedia) {
      return { success: false, error: "Write something or add media to publish." };
    }

    const { error } = await NetworkService.enqueue(() =>
      postService.createPost({
        content: trimmedContent,
        imageFile,
        isAnonymous,
      })
    );

    if (error) {
      console.error("Publish Post Error:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        error,
      });
      errorNotification();
      return { success: false, error: error?.message || "Unable to publish post." };
    }

    setDraft("");
    await loadPosts();
    mediumImpact();
    return { success: true };
  };

  const handleDeletePost = useCallback(
    async (postId, imageUrl = "") => {
      const { error } = await postService.deletePost(postId, imageUrl);

      if (error) {
        console.error("Delete Post Error:", error);
        return { success: false, error: error?.message || "Unable to delete post." };
      }

      setPosts((prevPosts) => prevPosts.filter((post) => post.id !== postId));
      return { success: true };
    },
    []
  );

  return (
    <div className="flex h-full min-h-[calc(100vh-64px)] min-w-0 flex-col pb-[calc(5.75rem+var(--safe-area-inset-bottom))] xl:w-full xl:max-w-[760px] xl:pb-8">
      <section
        id="stories-section"
        className={`relative z-10 mb-4 border-y px-3 py-3 sm:mb-5 sm:rounded-[1.5rem] sm:border sm:p-5 xl:p-4 ${
          isDark ? "border-slate-800 bg-slate-950/90" : "border-slate-200 bg-white"
        }`}
      >
        {storiesError ? (
          <p className={`mb-3 text-sm ${isDark ? "text-rose-300" : "text-rose-700"}`}>{storiesError}</p>
        ) : null}

        <div className="pointer-events-auto relative z-10 overflow-hidden">
          <button
            type="button"
            aria-label="Previous story card"
            onClick={handlePreviousStoryCard}
            disabled={storyRailIndex === 0}
            className="pointer-events-none absolute left-2 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-[rgba(40,20,80,.45)] text-sm font-bold text-white shadow-lg shadow-fuchsia-950/20 backdrop-blur-md transition hover:scale-105 hover:brightness-110 disabled:pointer-events-none disabled:opacity-30 sm:pointer-events-auto sm:flex"
          >
            ◀
          </button>

          <button
            type="button"
            aria-label="Next story card"
            onClick={handleNextStoryCard}
            disabled={storyRailIndex >= storyRailMaxIndex}
            className="pointer-events-none absolute right-2 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-[rgba(40,20,80,.45)] text-sm font-bold text-white shadow-lg shadow-fuchsia-950/20 backdrop-blur-md transition hover:scale-105 hover:brightness-110 disabled:pointer-events-none disabled:opacity-30 sm:pointer-events-auto sm:flex"
          >
            ▶
          </button>

          <div
            className="pointer-events-auto relative z-10 flex touch-pan-x snap-x gap-4 overflow-x-auto scroll-smooth pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-5 sm:overflow-visible sm:transition-transform sm:duration-300 sm:ease-out sm:[transform:translateX(var(--story-offset))]"
            style={{
              "--story-offset": `-${storyRailIndex * STORY_CARD_STEP_PX}px`,
              WebkitOverflowScrolling: "touch",
            }}
          >
            <article
              role="button"
              tabIndex={0}
              onClick={handleOpenMyStory}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleOpenMyStory();
                }
              }}
              className="pointer-events-auto relative z-10 flex w-[min(72vw,230px)] shrink-0 touch-manipulation snap-start flex-col rounded-[1.5rem] border border-slate-200 bg-white p-4 text-slate-900 shadow-[0_14px_30px_rgba(15,23,42,0.06)] transition hover:border-slate-300 sm:w-[230px] sm:p-5"
            >
              <div className="flex items-center gap-3.5">
                <div className="relative h-11 w-11 shrink-0">
                  {user?.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user?.full_name || user?.name || "My Story"}
                      className="h-11 w-11 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                      {(user?.full_name || user?.name || user?.email || "M").charAt(0).toUpperCase()}
                    </div>
                  )}
                  {!myActiveStory ? (
                    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-[#c446ff] text-sm font-bold leading-none text-white">
                      +
                    </span>
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900">My Story</p>
                </div>
              </div>

              <div className="relative mt-[18px]">
                <div className="pointer-events-auto block w-full text-left">
                  <div className="overflow-hidden rounded-[18px]">
                    {myActiveStory?.story_type === "text" ? (
                      <div
                        className={`flex aspect-square w-full items-center justify-center bg-gradient-to-br p-4 text-center ${getStoryBackgroundClass(
                          myActiveStory.background_color
                        )}`}
                      >
                        <p className="max-h-full overflow-hidden break-words text-xl font-bold leading-tight text-white">
                          {myActiveStory.content}
                        </p>
                      </div>
                    ) : myActiveStory?.image_url ? (
                      myActiveStory.media_type === "video" ? (
                        <video
                          src={myActiveStory.image_url}
                          muted
                          playsInline
                          preload="metadata"
                          className="aspect-square w-full object-cover"
                        />
                      ) : (
                        <img
                          src={myActiveStory.image_url}
                          alt="My story"
                          className="aspect-square w-full object-cover"
                        />
                      )
                    ) : (
                      <div className="flex aspect-square w-full items-center justify-center border border-dashed border-slate-300 bg-slate-50 text-5xl font-light text-slate-500">
                        +
                      </div>
                    )}
                  </div>
                </div>

                {myActiveStory ? (
                  <button
                    type="button"
                    aria-label="Add another story"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleOpenStoryComposer();
                    }}
                    className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-[#c446ff] text-2xl font-bold leading-none text-white shadow-lg shadow-fuchsia-950/20 transition hover:scale-105"
                  >
                    +
                  </button>
                ) : null}
              </div>
            </article>

            {visibleStories.map((story) => {
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

              const profilePath = story.user_id ? getProfilePath(story.user_id, user?.id) : null;
              const isStoryOwner = Boolean(user?.id && story.user_id === user.id);
              const viewerIndex = stories.findIndex((item) => item.id === story.id);

              return (
                <article
                  key={story.id}
                  className="pointer-events-auto relative z-10 flex w-[min(72vw,230px)] shrink-0 snap-start flex-col rounded-[1.5rem] border border-slate-200 bg-white p-4 text-slate-900 shadow-[0_14px_30px_rgba(15,23,42,0.06)] sm:w-[230px] sm:p-5"
                >
                  <div className="flex items-center gap-3.5">
                    {profilePath ? (
                      <Link to={profilePath} aria-label={`Open ${fullName || "user"} profile`} className="shrink-0 cursor-pointer">
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
                          className="block cursor-pointer truncate text-sm font-bold text-slate-900 transition hover:text-slate-700"
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
                    onClick={() => handleOpenStoryViewer(Math.max(viewerIndex, 0), story.id)}
                    className="pointer-events-auto mt-[18px] block touch-manipulation text-left"
                  >
                    <div className="overflow-hidden rounded-[18px]">
                      {story.story_type === "text" ? (
                        <div
                          className={`flex aspect-square w-full items-center justify-center bg-gradient-to-br p-4 text-center ${getStoryBackgroundClass(
                            story.background_color
                          )}`}
                        >
                          <p className="max-h-full overflow-hidden break-words text-xl font-bold leading-tight text-white">
                            {story.content}
                          </p>
                        </div>
                      ) : story.image_url ? (
                        story.media_type === "video" ? (
                          <video
                            src={story.image_url}
                            muted
                            playsInline
                            preload="metadata"
                            className="aspect-square w-full object-cover"
                          />
                        ) : (
                          <img
                            src={story.image_url}
                            alt={`${fullName || "Story"}'s story`}
                            className="aspect-square w-full object-cover"
                          />
                        )
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
        </div>

        {storyComposerOpen ? (
          <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/75 px-3 py-4 backdrop-blur-sm sm:px-4 sm:py-6">
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Create story"
              className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-[1.5rem] border border-white/20 bg-white p-4 text-slate-900 shadow-2xl shadow-purple-950/30 sm:max-h-[calc(100vh-3rem)] sm:p-6"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#c446ff]">My Story</p>
                  <h2 className="mt-1 text-xl font-bold text-slate-950">Create story</h2>
                </div>

                <button
                  type="button"
                  onClick={handleCloseStoryComposer}
                  disabled={storyUploading}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Close
                </button>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1 sm:gap-2 sm:rounded-full">
                {[
                  ["text", "📝 Text"],
                  ["photo", "📷 Photo"],
                  ["video", "🎥 Video"],
                ].map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setStoryComposerMode(mode);
                      setStoriesError("");
                    }}
                    className={`rounded-full px-2 py-2 text-xs font-semibold transition sm:px-3 sm:text-sm ${
                      storyComposerMode === mode
                        ? "bg-gradient-to-r from-fuchsia-500 to-violet-600 text-white shadow-lg shadow-fuchsia-950/20"
                        : "text-slate-600 hover:bg-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {storiesError ? (
                <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                  {storiesError}
                </p>
              ) : null}

              {storyComposerMode === "text" ? (
                <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_260px]">
                  <div className="space-y-4">
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-700">Text</span>
                      <textarea
                        value={storyText}
                        onChange={(event) => setStoryText(event.target.value.slice(0, STORY_TEXT_MAX_LENGTH))}
                        maxLength={STORY_TEXT_MAX_LENGTH}
                        rows={7}
                        className="mt-2 w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-fuchsia-400 focus:ring-4 focus:ring-fuchsia-100"
                        placeholder="Share a quick update..."
                      />
                    </label>

                    <div className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-500">
                      <span>{storyText.length}/{STORY_TEXT_MAX_LENGTH}</span>
                      <span>1 character minimum</span>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-slate-700">Background</p>
                      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                        {STORY_BACKGROUND_OPTIONS.map((background) => (
                          <button
                            key={background.id}
                            type="button"
                            aria-label={background.label}
                            title={background.label}
                            onClick={() => setStoryBackground(background.id)}
                            className={`h-11 rounded-full bg-gradient-to-br ${background.className} ${
                              storyBackground === background.id
                                ? "ring-4 ring-fuchsia-200 ring-offset-2"
                                : "ring-1 ring-slate-200"
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleCreateTextStory}
                      disabled={storyUploading || storyText.trim().length === 0}
                      className="w-full rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-fuchsia-950/20 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {storyUploading ? "Publishing..." : "Publish Story"}
                    </button>
                  </div>

                  <div
                    className={`flex min-h-[220px] items-center justify-center rounded-[1.5rem] bg-gradient-to-br p-5 text-center shadow-inner sm:min-h-[260px] ${getStoryBackgroundClass(
                      storyBackground
                    )}`}
                  >
                    <p className="max-h-full overflow-hidden break-words text-2xl font-bold leading-tight text-white sm:text-3xl">
                      {storyText.trim() || "Your story"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-[1.5rem] border border-dashed border-slate-300 p-6 text-center">
                  <p className="text-sm font-semibold text-slate-700">
                    {storyComposerMode === "photo" ? "Choose a photo story" : "Choose a video story"}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {storyComposerMode === "photo"
                      ? "JPG, JPEG, PNG, or WEBP. Maximum 25 MB."
                      : "MP4, MOV, or WebM. Maximum 45 seconds and 25 MB."}
                  </p>

                  <button
                    type="button"
                    onClick={handleOpenStoryFilePicker}
                    disabled={storyUploading}
                    className="mt-5 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-fuchsia-950/20 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {storyUploading ? "Uploading..." : storyComposerMode === "photo" ? "Select Photo" : "Select Video"}
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : null}

        <input
          ref={storyInputRef}
          type="file"
          accept={
            storyComposerMode === "video"
              ? "video/mp4,video/quicktime,video/webm"
              : "image/jpeg,image/png,image/webp"
          }
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
        announcements={announcements}
        announcementsLoading={announcementsLoading}
        announcementsError={announcementsError}
        onRetryAnnouncements={loadAnnouncements}
        onDeletePost={handleDeletePost}
        onReactionUpdated={handlePostReactionUpdated}
        focusedPostId={focusedPostId}
        focusedCommentId={focusedCommentId}
        shouldOpenFocusedComments={shouldOpenFocusedComments}
      />

      <StoryViewer
        key={storyViewerSession}
        isOpen={storyViewerOpen}
        stories={stories}
        initialIndex={storyViewerIndex}
        initialStoryId={storyViewerStoryId}
        currentUserId={user?.id || ""}
        onClose={handleCloseStoryViewer}
      />
    </div>
  );
}

export default HomePage;
