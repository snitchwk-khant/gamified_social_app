import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

const AUTO_ADVANCE_MS = 5000;

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

function StoryViewer({ isOpen, stories = [], initialIndex = 0, onClose }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const activeStoryIdRef = useRef(null);
  const initializedViewerRef = useRef(false);
  const initialIndexRef = useRef(initialIndex);

  useEffect(() => {
    if (!isOpen) {
      initializedViewerRef.current = false;
      return;
    }

    if (!isOpen || stories.length === 0) {
      return;
    }

    if (initializedViewerRef.current && initialIndexRef.current === initialIndex) {
      return;
    }

    const nextIndex = clampIndex(initialIndex, stories.length);
    activeStoryIdRef.current = stories[nextIndex]?.id || null;
    initializedViewerRef.current = true;
    initialIndexRef.current = initialIndex;
    setActiveIndex(nextIndex);
    setProgress(0);
  }, [initialIndex, isOpen, stories]);

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
      const nextProgress = Math.min(elapsed / AUTO_ADVANCE_MS, 1);
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
  }, [activeIndex, isOpen, onClose, stories]);

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

  useEffect(() => {
    if (!isOpen || !activeStory?.id) {
      return;
    }

    activeStoryIdRef.current = activeStory.id;
  }, [activeStory?.id, isOpen]);

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

      <div className="absolute left-0 right-0 top-0 z-20 px-3 pt-3 sm:px-6 sm:pt-4">
        <div className="flex gap-1.5">
          {progressSegments.map((segment) => (
            <div key={segment.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
              <div
                className="h-full rounded-full bg-white transition-[width] duration-75"
                style={{ width: `${Math.max(0, Math.min(1, segment.value)) * 100}%` }}
              />
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 text-white">
          <div className="flex min-w-0 items-center gap-3">
            {profilePath ? (
              <Link to={profilePath} aria-label={`Open ${displayName || "user"} profile`} className="shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName || "Story avatar"}
                    className="h-10 w-10 rounded-full border border-white/40 object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-white/10 text-xs font-semibold">
                    {getInitials(displayName)}
                  </div>
                )}
              </Link>
            ) : avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName || "Story avatar"}
                className="h-10 w-10 shrink-0 rounded-full border border-white/40 object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/40 bg-white/10 text-xs font-semibold">
                {getInitials(displayName)}
              </div>
            )}

            <div className="min-w-0">
              {profilePath ? (
                <Link to={profilePath} className="block truncate text-sm font-semibold transition hover:text-white/80">
                  {displayName}
                </Link>
              ) : (
                <p className="truncate text-sm font-semibold">{displayName}</p>
              )}
              <p className="truncate text-xs text-white/80">{activeStory.created_at_label || "Just now"}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/40 bg-black/40 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-black/60"
          >
            Close
          </button>
        </div>
      </div>

      <div className="relative z-0 flex h-full w-full items-center justify-center p-4 pt-24 sm:p-8 sm:pt-28">
        {activeStory.image_url ? (
          <img
            src={activeStory.image_url}
            alt={`${displayName || "Story"}'s story`}
            className="max-h-full max-w-full rounded-2xl object-contain"
          />
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
