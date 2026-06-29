import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getStoryViewCount, recordStoryView } from "../../services/stories_service";

const AUTO_ADVANCE_MS = 5000;
const STORY_BACKGROUND_CLASSES = {
  purple: "from-fuchsia-500 via-purple-600 to-violet-700",
  pink: "from-rose-400 via-fuchsia-500 to-pink-700",
  blue: "from-sky-400 via-blue-600 to-indigo-800",
  orange: "from-amber-300 via-orange-500 to-rose-600",
  green: "from-emerald-300 via-green-500 to-teal-800",
  dark: "from-slate-900 via-purple-950 to-black",
};

function getStoryBackgroundClass(backgroundId) {
  return STORY_BACKGROUND_CLASSES[backgroundId] || STORY_BACKGROUND_CLASSES.purple;
}

function clampIndex(index, storiesLength) {
  if (!storiesLength) {
    return 0;
  }

  if (index < 0) {
    return 0;
  }

  if (index >= storiesLength) {
    return storiesLength - 1;
  }

  return index;
}

function getInitialStoryIndex(stories, initialIndex, initialStoryId) {
  if (initialStoryId) {
    const storyIndex = stories.findIndex((story) => story.id === initialStoryId);

    if (storyIndex !== -1) {
      return storyIndex;
    }
  }

  return clampIndex(initialIndex, stories.length);
}

function getInitials(name) {
  if (!name) {
    return "U";
  }

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "U";
}

function StoryViewer({ isOpen, stories = [], initialIndex = 0, initialStoryId = null, currentUserId = "", onClose }) {
  const [activeIndex, setActiveIndex] = useState(() => getInitialStoryIndex(stories, initialIndex, initialStoryId));
  const [progress, setProgress] = useState(0);
  const [activeDurationMs, setActiveDurationMs] = useState(AUTO_ADVANCE_MS);
  const [viewCount, setViewCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const activeStoryIdRef = useRef(null);
  const initializedViewerRef = useRef(false);
  const initialIndexRef = useRef(initialIndex);
  const initialStoryIdRef = useRef(initialStoryId);

  useEffect(() => {
    if (!isOpen) {
      initializedViewerRef.current = false;
      setSoundEnabled(false);
      return;
    }

    if (!isOpen || stories.length === 0) {
      return;
    }

    if (
      initializedViewerRef.current &&
      initialIndexRef.current === initialIndex &&
      initialStoryIdRef.current === initialStoryId
    ) {
      return;
    }

    const nextIndex = getInitialStoryIndex(stories, initialIndex, initialStoryId);
    activeStoryIdRef.current = stories[nextIndex]?.id || null;
    initializedViewerRef.current = true;
    initialIndexRef.current = initialIndex;
    initialStoryIdRef.current = initialStoryId;
    setActiveIndex(nextIndex);
    setProgress(0);
  }, [initialIndex, initialStoryId, isOpen, stories]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (stories.length === 0) {
      activeStoryIdRef.current = null;
      if (typeof onClose === "function") {
        onClose();
      }
      return;
    }

    setActiveIndex((currentIndex) => {
      const activeStoryId = activeStoryIdRef.current;

      if (activeStoryId) {
        const nextIndex = stories.findIndex((story) => story.id === activeStoryId);

        if (nextIndex !== -1) {
          return nextIndex;
        }
      }

      const nextIndex = clampIndex(currentIndex, stories.length);
      activeStoryIdRef.current = stories[nextIndex]?.id || null;
      return nextIndex;
    });
  }, [isOpen, onClose, stories]);

  useEffect(() => {
    if (!isOpen || stories.length === 0) {
      return;
    }

    let frameId = 0;
    const startedAt = performance.now();

    const tick = () => {
      const elapsed = performance.now() - startedAt;
      const nextProgress = Math.min(elapsed / activeDurationMs, 1);
      setProgress(nextProgress);

      if (nextProgress >= 1) {
        setActiveIndex((prev) => {
          if (prev >= stories.length - 1) {
            if (typeof onClose === "function") {
              onClose();
            }

            return prev;
          }

          const nextIndex = prev + 1;
          activeStoryIdRef.current = stories[nextIndex]?.id || null;
          return nextIndex;
        });
        return;
      }

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [activeDurationMs, activeIndex, isOpen, onClose, stories]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (typeof onClose === "function") {
          onClose();
        }
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setActiveIndex((prev) => {
          const nextIndex = Math.max(prev - 1, 0);
          activeStoryIdRef.current = stories[nextIndex]?.id || null;
          return nextIndex;
        });
        setProgress(0);
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        setActiveIndex((prev) => {
          if (prev >= stories.length - 1) {
            if (typeof onClose === "function") {
              onClose();
            }
            return prev;
          }
          const nextIndex = prev + 1;
          activeStoryIdRef.current = stories[nextIndex]?.id || null;
          return nextIndex;
        });
        setProgress(0);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, stories]);

  const activeStory = stories[activeIndex] || null;
  const profile = activeStory?.profile || null;
  const displayName = profile?.full_name || activeStory?.author_name || "";
  const avatarUrl = profile?.avatar_url ?? activeStory?.author_avatar ?? null;
  const profilePath = activeStory?.user_id ? `/profile/${activeStory.user_id}` : null;
  const isStoryOwner = Boolean(currentUserId && activeStory?.user_id === currentUserId);
  const isTextStory = activeStory?.story_type === "text";
  const isVideoStory = activeStory?.media_type === "video";

  useEffect(() => {
    if (!isOpen || !activeStory?.id) {
      return;
    }

    activeStoryIdRef.current = activeStory.id;
  }, [activeStory?.id, isOpen]);

  useEffect(() => {
    setActiveDurationMs(AUTO_ADVANCE_MS);
  }, [activeStory?.id]);

  useEffect(() => {
    setViewCount(Number(activeStory?.view_count || 0));
  }, [activeStory?.id, activeStory?.view_count]);

  useEffect(() => {
    if (!isOpen || !activeStory?.id || !isStoryOwner) {
      return;
    }

    let isCurrent = true;

    getStoryViewCount(activeStory.id).then((nextCount) => {
      if (isCurrent) {
        setViewCount(nextCount);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [activeStory?.id, isOpen, isStoryOwner]);

  useEffect(() => {
    if (!isOpen || !activeStory?.id || !activeStory?.user_id || !currentUserId || isStoryOwner) {
      return;
    }

    recordStoryView(activeStory.id, activeStory.user_id).then(({ error }) => {
      if (error) {
        console.error("Story view record failed:", error);
      }
    });
  }, [activeStory?.id, activeStory?.user_id, currentUserId, isOpen, isStoryOwner]);

  const progressSegments = useMemo(() => {
    return stories.map((story, index) => {
      if (index < activeIndex) {
        return { id: story.id, value: 1 };
      }

      if (index === activeIndex) {
        return { id: story.id, value: progress };
      }

      return { id: story.id, value: 0 };
    });
  }, [activeIndex, progress, stories]);

  if (!isOpen || stories.length === 0 || !activeStory) {
    return null;
  }

  const handlePrevious = () => {
    setActiveIndex((prev) => {
      const nextIndex = Math.max(prev - 1, 0);
      activeStoryIdRef.current = stories[nextIndex]?.id || null;
      return nextIndex;
    });
    setProgress(0);
  };

  const handleNext = () => {
    setActiveIndex((prev) => {
      if (prev >= stories.length - 1) {
        if (typeof onClose === "function") {
          onClose();
        }
        return prev;
      }

      const nextIndex = prev + 1;
      activeStoryIdRef.current = stories[nextIndex]?.id || null;
      return nextIndex;
    });
    setProgress(0);
  };

  const handleProgressSegmentClick = (index) => {
    const nextIndex = clampIndex(index, stories.length);
    activeStoryIdRef.current = stories[nextIndex]?.id || null;
    setActiveIndex(nextIndex);
    setProgress(0);
  };

  const handleVideoLoadedMetadata = (event) => {
    const durationSeconds = event.currentTarget.duration;

    if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
      setActiveDurationMs(durationSeconds * 1000);
      setProgress(0);
    }
  };

  const handleSoundToggle = () => {
    setSoundEnabled((currentValue) => !currentValue);
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/95">
      <button
        type="button"
        aria-label="Previous story"
        onClick={handlePrevious}
        className="absolute inset-y-0 left-0 z-10 w-1/2 cursor-pointer bg-transparent"
      />
      <button
        type="button"
        aria-label="Next story"
        onClick={handleNext}
        className="absolute inset-y-0 right-0 z-10 w-1/2 cursor-pointer bg-transparent"
      />

      <div className="absolute left-0 right-0 top-0 z-20 px-2 pt-2 sm:px-6 sm:pt-4">
        <div className="flex gap-1.5">
          {progressSegments.map((segment, index) => (
            <button
              key={segment.id}
              type="button"
              aria-label={`Open story ${index + 1}`}
              onClick={() => handleProgressSegmentClick(index)}
              className="h-1 flex-1 cursor-pointer overflow-hidden rounded-full bg-white/25 p-0"
            >
              <div
                className="h-full rounded-full bg-white transition-[width] duration-75"
                style={{ width: `${Math.max(0, Math.min(1, segment.value)) * 100}%` }}
              />
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 text-white sm:gap-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {profilePath ? (
              <Link to={profilePath} aria-label={`Open ${displayName || "user"} profile`} className="shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName || "Story avatar"}
                    className="h-9 w-9 rounded-full border border-white/40 object-cover sm:h-10 sm:w-10"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/40 bg-white/10 text-xs font-semibold sm:h-10 sm:w-10">
                    {getInitials(displayName)}
                  </div>
                )}
              </Link>
            ) : avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName || "Story avatar"}
                className="h-9 w-9 shrink-0 rounded-full border border-white/40 object-cover sm:h-10 sm:w-10"
              />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/40 bg-white/10 text-xs font-semibold sm:h-10 sm:w-10">
                {getInitials(displayName)}
              </div>
            )}

            <div className="min-w-0">
              {profilePath ? (
                <Link to={profilePath} className="block max-w-[9rem] truncate text-xs font-semibold transition hover:text-white/80 sm:max-w-none sm:text-sm">
                  {displayName}
                </Link>
              ) : (
                <p className="max-w-[9rem] truncate text-xs font-semibold sm:max-w-none sm:text-sm">{displayName}</p>
              )}
              <p className="truncate text-xs text-white/80">{activeStory.created_at_label || "Just now"}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {isVideoStory ? (
              <button
                type="button"
                aria-label={soundEnabled ? "Mute story video" : "Unmute story video"}
                onClick={handleSoundToggle}
                className="rounded-full border border-white/40 bg-black/40 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-black/60 sm:px-3"
              >
                {soundEnabled ? "🔊" : "🔇"}
              </button>
            ) : null}

            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/40 bg-black/40 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-black/60 sm:px-3"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {isStoryOwner ? (
        <div className="absolute bottom-4 right-4 z-20 rounded-full bg-gradient-to-r from-fuchsia-500/85 to-violet-600/85 px-3 py-1 text-xs font-semibold text-white shadow-lg shadow-fuchsia-950/30 backdrop-blur-md transition hover:from-fuchsia-500 hover:to-violet-600 sm:bottom-8 sm:right-8">
          Views {viewCount}
        </div>
      ) : null}

      <div
        className={`relative z-0 flex h-full w-full items-center justify-center ${
          isTextStory ? "p-0" : "p-2 pt-24 sm:p-8 sm:pt-28"
        }`}
      >
        {isTextStory ? (
          <div
            className={`flex h-full w-full items-center justify-center bg-gradient-to-br px-5 pb-20 pt-28 text-center sm:px-12 sm:pt-32 ${getStoryBackgroundClass(
              activeStory.background_color
            )}`}
          >
            <p className="max-w-3xl whitespace-pre-wrap break-words text-2xl font-bold leading-tight text-white sm:text-5xl">
              {activeStory.content}
            </p>
          </div>
        ) : activeStory.image_url ? (
          isVideoStory ? (
            <video
              key={activeStory.id}
              src={activeStory.image_url}
              autoPlay
              muted={!soundEnabled}
              playsInline
              controls={false}
              loop={false}
              onEnded={handleNext}
              onLoadedMetadata={handleVideoLoadedMetadata}
              className="max-h-full max-w-full rounded-2xl object-contain"
            />
          ) : (
            <img
              src={activeStory.image_url}
              alt={`${displayName || "Story"}'s story`}
              className="max-h-full max-w-full rounded-2xl object-contain"
            />
          )
        ) : (
          <div className="flex h-[70vh] w-full max-w-xl items-center justify-center rounded-2xl bg-white/10 text-sm text-white/80">
            No image available
          </div>
        )}
      </div>
    </div>
  );
}

export default StoryViewer;
