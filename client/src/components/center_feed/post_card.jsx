import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/auth_context";
import { useTheme } from "../../context/theme_context";
import { supabase } from "../../lib/supabase";
import {
  getPostLoves,
  getPostReactionSummary,
  parsePostMediaUrls,
  setPostReaction,
  subscribeToPostLikes,
} from "../../services/post_service";
import { getProfilePath } from "../../utils/profile_path";
import CommentForm from "./comment_form";
import CommentList from "./comment_list";

function formatRelativeTime(dateString) {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return `${diffWeeks}w ago`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;

  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears}y ago`;
}

function isPostVideoUrl(url) {
  if (!url) {
    return false;
  }

  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return /\.(mp4|mov|webm)$/.test(pathname);
  } catch {
    return /\.(mp4|mov|webm)(\?|#|$)/i.test(url);
  }
}

function FeedVideoPlayer({ src, isDark }) {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [buffering, setBuffering] = useState(false);

  async function togglePlayback() {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    if (video.paused) {
      setBuffering(true);

      try {
        await video.play();
      } catch {
        setBuffering(false);
      }
    } else {
      video.pause();
    }
  }

  function toggleMute(event) {
    event.stopPropagation();
    setMuted((currentMuted) => !currentMuted);
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-black">
      <video
        ref={videoRef}
        src={src}
        muted={muted}
        playsInline
        preload="metadata"
        onClick={togglePlayback}
        onWaiting={() => setBuffering(true)}
        onLoadStart={() => setBuffering(true)}
        onCanPlay={() => setBuffering(false)}
        onPlaying={() => {
          setPlaying(true);
          setBuffering(false);
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        className="aspect-video max-h-[520px] w-full cursor-pointer object-contain"
      />

      {buffering ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
          <span className="rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold text-white">
            Loading...
          </span>
        </div>
      ) : null}

      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={togglePlayback}
          className="rounded-full bg-black/70 px-3 py-2 text-xs font-semibold text-white shadow-lg transition hover:bg-black"
        >
          {playing ? "⏸ Pause" : "▶ Play"}
        </button>

        <button
          type="button"
          onClick={toggleMute}
          className={`rounded-full px-3 py-2 text-xs font-semibold shadow-lg transition ${
            isDark ? "bg-slate-950/80 text-slate-100 hover:bg-slate-950" : "bg-white/90 text-slate-900 hover:bg-white"
          }`}
        >
          {muted ? "🔊 Unmute" : "🔇 Mute"}
        </button>
      </div>
    </div>
  );
}

function FeedImageCarousel({ urls, isDark }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [loadedIndexes, setLoadedIndexes] = useState(() => new Set([0, 1]));
  const [dragOffset, setDragOffset] = useState(0);
  const dragOffsetRef = useRef(0);
  const pointerStartRef = useRef(null);
  const suppressClickRef = useRef(false);
  const lastWheelMoveRef = useRef(0);
  const touchStartRef = useRef(null);
  const hasMultipleImages = urls.length > 1;

  useEffect(() => {
    setActiveIndex(0);
    setViewerIndex(0);
    setViewerOpen(false);
    setLoadedIndexes(new Set([0, 1]));
    setDragOffset(0);
    dragOffsetRef.current = 0;
  }, [urls]);

  useEffect(() => {
    setLoadedIndexes((currentIndexes) => {
      const nextIndexes = new Set(currentIndexes);
      nextIndexes.add(activeIndex);
      nextIndexes.add(activeIndex - 1);
      nextIndexes.add(activeIndex + 1);
      return nextIndexes;
    });
  }, [activeIndex]);

  function clampIndex(nextIndex) {
    return Math.max(0, Math.min(urls.length - 1, nextIndex));
  }

  function moveImage(direction, isViewer = false) {
    if (isViewer) {
      setViewerIndex((currentIndex) => clampIndex(currentIndex + direction));
      return;
    }

    setActiveIndex((currentIndex) => clampIndex(currentIndex + direction));
  }

  function handlePointerDown(event) {
    if (!hasMultipleImages) {
      return;
    }

    pointerStartRef.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      dragging: false,
    };
    suppressClickRef.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event) {
    const start = pointerStartRef.current;

    if (!start || start.id !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;

    if (!start.dragging && Math.abs(deltaX) < 8) {
      return;
    }

    if (!start.dragging && Math.abs(deltaY) > Math.abs(deltaX)) {
      return;
    }

    start.dragging = true;
    suppressClickRef.current = true;
    dragOffsetRef.current = deltaX;
    setDragOffset(deltaX);
    event.preventDefault();
  }

  function handlePointerEnd(event) {
    const start = pointerStartRef.current;

    if (!start || start.id !== event.pointerId) {
      return;
    }

    const finalOffset = dragOffsetRef.current;
    pointerStartRef.current = null;
    dragOffsetRef.current = 0;
    setDragOffset(0);
    event.currentTarget.releasePointerCapture?.(event.pointerId);

    if (!start.dragging || Math.abs(finalOffset) < 45) {
      setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
      return;
    }

    moveImage(finalOffset < 0 ? 1 : -1);
    setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  }

  function handleHorizontalWheel(event) {
    if (!hasMultipleImages || Math.abs(event.deltaX) <= Math.abs(event.deltaY) || Math.abs(event.deltaX) < 24) {
      return;
    }

    const now = Date.now();
    if (now - lastWheelMoveRef.current < 350) {
      event.preventDefault();
      return;
    }

    lastWheelMoveRef.current = now;
    event.preventDefault();
    moveImage(event.deltaX > 0 ? 1 : -1);
  }

  function handleTouchStart(event) {
    const touch = event.touches[0];
    touchStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  }

  function handleTouchEnd(event, isViewer = false) {
    const start = touchStartRef.current;
    const touch = event.changedTouches[0];
    touchStartRef.current = null;

    if (!start || !touch) {
      return;
    }

    const horizontalDistance = start.x - touch.clientX;
    const verticalDistance = touch.clientY - start.y;

    if (isViewer && verticalDistance > 70 && Math.abs(verticalDistance) > Math.abs(horizontalDistance)) {
      setViewerOpen(false);
      return;
    }

    if (!hasMultipleImages || Math.abs(horizontalDistance) < 40) {
      return;
    }

    moveImage(horizontalDistance > 0 ? 1 : -1, isViewer);
  }

  function openViewer(index) {
    if (suppressClickRef.current) {
      return;
    }

    setViewerIndex(index);
    setViewerOpen(true);
  }

  if (!urls.length) {
    return null;
  }

  return (
    <>
      <div
        className="relative overflow-hidden rounded-2xl touch-pan-y"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onWheel={handleHorizontalWheel}
      >
        <div
          className={`flex ${dragOffset ? "" : "transition-transform duration-200 ease-out"}`}
          style={{ transform: `translateX(calc(-${activeIndex * 100}% + ${dragOffset}px))` }}
        >
          {urls.map((url, index) => (
            <button
              key={`${url}-${index}`}
              type="button"
              onClick={() => openViewer(index)}
              className="w-full shrink-0 cursor-pointer bg-transparent p-0"
              aria-label={`Open image ${index + 1}`}
            >
              {loadedIndexes.has(index) ? (
                <img
                  src={url}
                  alt={`Post attachment ${index + 1}`}
                  loading={Math.abs(index - activeIndex) <= 1 ? "eager" : "lazy"}
                  draggable={false}
                  className="max-h-[520px] w-full select-none object-contain"
                />
              ) : (
                <div className={`aspect-video w-full ${isDark ? "bg-slate-950" : "bg-slate-100"}`} />
              )}
            </button>
          ))}
        </div>

        {hasMultipleImages ? (
          <div className="absolute right-3 top-3 rounded-full bg-black/65 px-2.5 py-1 text-xs font-semibold text-white shadow-lg">
            {activeIndex + 1} / {urls.length}
          </div>
        ) : null}
      </div>

      {hasMultipleImages ? (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {urls.map((url, index) => (
            <span
              key={`${url}-indicator-${index}`}
              className={`h-1.5 rounded-full transition-all ${
                index === activeIndex
                  ? isDark
                    ? "w-4 bg-sky-300"
                    : "w-4 bg-[#c446ff]"
                  : isDark
                    ? "w-1.5 bg-slate-600"
                    : "w-1.5 bg-slate-300"
              }`}
            />
          ))}
        </div>
      ) : null}

      {viewerOpen ? (
        <div
          className="fixed inset-0 z-50 flex animate-[profile-view-in_180ms_ease-out] items-center justify-center bg-black/95 px-4 py-6"
          onTouchStart={handleTouchStart}
          onTouchEnd={(event) => handleTouchEnd(event, true)}
        >
          <button
            type="button"
            onClick={() => setViewerOpen(false)}
            aria-label="Close image viewer"
            className={`absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full text-2xl font-semibold leading-none transition ${
              isDark ? "bg-slate-950/80 text-slate-100 hover:bg-slate-950" : "bg-white/90 text-slate-900 hover:bg-white"
            }`}
          >
            ×
          </button>

          <img
            src={urls[viewerIndex]}
            alt={`Post attachment ${viewerIndex + 1}`}
            className="max-h-[84vh] w-full max-w-3xl rounded-2xl object-contain transition-transform duration-200 ease-out"
          />

          {hasMultipleImages ? (
            <>
              <button
                type="button"
                onClick={() => moveImage(-1, true)}
                disabled={viewerIndex === 0}
                aria-label="Previous image"
                className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-xl font-semibold text-white shadow-lg transition hover:bg-black/75 disabled:cursor-not-allowed disabled:opacity-35 sm:left-6 sm:h-12 sm:w-12"
              >
                ◀
              </button>

              <button
                type="button"
                onClick={() => moveImage(1, true)}
                disabled={viewerIndex === urls.length - 1}
                aria-label="Next image"
                className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-xl font-semibold text-white shadow-lg transition hover:bg-black/75 disabled:cursor-not-allowed disabled:opacity-35 sm:right-6 sm:h-12 sm:w-12"
              >
                ▶
              </button>
            </>
          ) : null}

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold text-white">
            {viewerIndex + 1} / {urls.length}
          </div>
        </div>
      ) : null}
    </>
  );
}

function PostCard({
  id,
  body,
  date,
  commentsCount = 0,
  likeCount = 0,
  reactionsCount = 0,
  userReaction = null,
  isAnonymous = false,
  authorUserId = null,
  authorName = "",
  authorAvatar = null,
  imageUrl = null,
  profile = null,
  onCommentCreated,
  onDeletePost,
  onReactionUpdated,
}) {
  const { user } = useAuth();
  const { isDark } = useTheme();

  const [comments, setComments] = useState([]);
  const [commentOpen, setCommentOpen] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentCount, setCommentCount] = useState(commentsCount);
  const [replyingToComment, setReplyingToComment] = useState(null);
  const [mentionUsers, setMentionUsers] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [loveListOpen, setLoveListOpen] = useState(false);
  const [loveList, setLoveList] = useState([]);
  const [loveListLoading, setLoveListLoading] = useState(false);
  const [loveListError, setLoveListError] = useState("");
  const [currentLoveCount, setCurrentLoveCount] = useState(reactionsCount || likeCount);
  const [hasLoved, setHasLoved] = useState(Boolean(userReaction));
  const [loveToggling, setLoveToggling] = useState(false);
  const [loveAnimating, setLoveAnimating] = useState(false);
  const commentSheetTouchStartYRef = useRef(null);
  const maskedAvatarPath = "/masked-avatar.jpg";
  const canDelete = Boolean(user?.id && authorUserId === user.id);
  const canViewLoveList = canDelete;
  const mediaUrls = useMemo(() => parsePostMediaUrls(imageUrl), [imageUrl]);
  const isVideoPost = mediaUrls.length === 1 && isPostVideoUrl(mediaUrls[0]);

  useEffect(() => {
    setCommentCount(commentsCount);
  }, [commentsCount, id]);

  useEffect(() => {
    setCurrentLoveCount(Number(reactionsCount ?? likeCount ?? 0));
    setHasLoved(Boolean(userReaction));
  }, [id, likeCount, reactionsCount, userReaction]);

  useEffect(() => {
    if (!id) {
      return undefined;
    }

    return subscribeToPostLikes(id, async () => {
      const summary = await getPostReactionSummary(id);
      setHasLoved(Boolean(summary.user_reaction));
      setCurrentLoveCount(Number(summary.reactions_count || summary.like_count || 0));
      if (typeof onReactionUpdated === "function") {
        onReactionUpdated(id, summary);
      }
    });
  }, [id, onReactionUpdated]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const avatarUrl = user.avatar_url || null;

    setComments((currentComments) =>
      currentComments.map((comment) => {
        if (comment.is_anonymous || comment.user_id !== user.id) {
          return comment;
        }

        return {
          ...comment,
          author_avatar: avatarUrl,
          profile: comment.profile
            ? {
                ...comment.profile,
                avatar_url: avatarUrl,
              }
            : comment.profile,
        };
      })
    );
  }, [user?.avatar_url, user?.id]);

  async function formatCommentRows(commentRows) {
    const authorIds = [
      ...new Set((commentRows || []).filter((comment) => !comment.is_anonymous && comment.user_id).map((comment) => comment.user_id)),
    ];

    let profileMap = {};

    if (authorIds.length) {
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", authorIds);

      if (profileError) {
        console.error("Load Comment Profiles Error:", {
          code: profileError.code,
          message: profileError.message,
          details: profileError.details,
          hint: profileError.hint,
          error: profileError,
        });
      } else {
        profileMap = Object.fromEntries((profiles || []).map((profile) => [profile.id, profile]));
      }
    }

    return (commentRows || []).map((comment) => {
      const profile = !comment.is_anonymous ? profileMap[comment.user_id] : null;
      const fullName = profile?.full_name || "";

      return {
        ...comment,
        author_name: comment.is_anonymous ? "Masked" : fullName,
        author_avatar: comment.is_anonymous ? maskedAvatarPath : profile?.avatar_url || null,
        profile: comment.is_anonymous
          ? null
          : {
              id: profile?.id || comment.user_id,
              full_name: fullName,
              avatar_url: profile?.avatar_url || null,
            },
      };
    });
  }

  async function loadMentionUsers() {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .order("full_name", { ascending: true });

    if (error) {
      console.error("Load Mention Users Error:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        error,
      });
      return;
    }

    setMentionUsers((data || []).filter((profileRow) => profileRow.id && profileRow.full_name));
  }

  async function loadComments() {
    setLoadingComments(true);

    const { data, error } = await supabase
      .from("comments")
      .select("id, content, created_at, is_anonymous, user_id, parent_comment_id")
      .eq("post_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Load Comments Error:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        error,
      });
      setComments([]);
      setCommentCount(0);
      setLoadingComments(false);
      return;
    }

    const formattedComments = await formatCommentRows(data || []);

    setComments(formattedComments);
    setCommentCount(formattedComments.length);
    setLoadingComments(false);
  }

  useEffect(() => {
    if (!commentOpen) return;

    loadComments();
    loadMentionUsers();

    const channel = supabase
      .channel(`comments-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
          filter: `post_id=eq.${id}`,
        },
        async (payload) => {
          if (payload.eventType === "DELETE") {
            const deletedCommentId = payload.old?.id;

            if (!deletedCommentId) return;

            setComments((currentComments) => {
              const nextComments = currentComments.filter((comment) => comment.id !== deletedCommentId && comment.parent_comment_id !== deletedCommentId);
              const removedCount = currentComments.length - nextComments.length;

              if (removedCount) {
                setCommentCount((currentCount) => Math.max(0, Number(currentCount || 0) - removedCount));
              }

              return nextComments;
            });
            return;
          }

          if (payload.new?.id) {
            const [formattedComment] = await formatCommentRows([payload.new]);

            if (formattedComment) {
              upsertComment(formattedComment);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [commentOpen, id]);

  function upsertComment(nextComment) {
    setComments((currentComments) => {
      const exists = currentComments.some((comment) => comment.id === nextComment.id);
      const nextComments = exists
        ? currentComments.map((comment) => (comment.id === nextComment.id ? nextComment : comment))
        : [...currentComments, nextComment];

      if (!exists) {
        setCommentCount((currentCount) => Number(currentCount || 0) + 1);
      }

      return nextComments.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    });
  }

  function getMentionedUserIds(content) {
    const normalizedContent = String(content || "").toLowerCase();

    return [
      ...new Set(
        mentionUsers
          .filter((mentionUser) => {
            const name = mentionUser.full_name?.toLowerCase();
            return name && normalizedContent.includes(`@${name}`);
          })
          .map((mentionUser) => mentionUser.id)
      ),
    ];
  }

  async function createCommentNotification(targetUserId, title, message, commentId) {
    if (!targetUserId || targetUserId === user?.id) {
      return;
    }

    const { error } = await supabase.rpc("create_comment_notification", {
      target_user_id: targetUserId,
      notification_title: title,
      notification_message: message,
      source_post_id: id,
      source_comment_id: commentId,
      notification_category: "Mention",
    });

    if (error) {
      console.error("Create Comment Notification Error:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        error,
      });
    }
  }

  async function notifyCommentRecipients(content, insertedComment, parentComment = null) {
    const recipientIds = new Map();

    getMentionedUserIds(content).forEach((recipientId) => {
      recipientIds.set(recipientId, "You were mentioned in a comment.");
    });

    if (parentComment?.user_id && !recipientIds.has(parentComment.user_id)) {
      recipientIds.set(parentComment.user_id, "Someone replied to your comment.");
    }

    await Promise.all(
      Array.from(recipientIds.entries()).map(([recipientId, title]) =>
        createCommentNotification(recipientId, title, content, insertedComment.id)
      )
    );
  }

  async function handleCommentSubmit(content, isAnonymous = false, parentCommentId = null) {
    if (!user?.id) return false;

    const trimmedContent = content?.trim();
    if (!trimmedContent) return false;

    const resolvedParentCommentId = parentCommentId || null;
    const parentComment = resolvedParentCommentId
      ? comments.find((comment) => comment.id === resolvedParentCommentId) || null
      : null;

    const insertPayload = {
      post_id: id,
      user_id: user.id,
      content: trimmedContent,
      is_anonymous: isAnonymous,
      parent_comment_id: resolvedParentCommentId,
    };

    const { data, error } = await supabase
      .from("comments")
      .insert(insertPayload)
      .select("id, content, created_at, is_anonymous, user_id, parent_comment_id")
      .single();

    if (error) {
      console.error("Comment Insert Error:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        error,
      });
      return false;
    }

    const [formattedComment] = await formatCommentRows([data]);
    upsertComment(formattedComment);
    setReplyingToComment(null);

    if (typeof onCommentCreated === "function") {
      onCommentCreated(id);
    }

    await notifyCommentRecipients(trimmedContent, data, parentComment);

    return true;
  }

  async function handleDeleteComment(commentId) {
    if (!user?.id || !commentId) {
      return false;
    }

    const { error } = await supabase
      .from("comments")
      .delete()
      .eq("id", commentId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Comment Delete Error:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        error,
      });
      return false;
    }

    setComments((currentComments) => {
      const nextComments = currentComments.filter((comment) => comment.id !== commentId && comment.parent_comment_id !== commentId);
      const removedCount = currentComments.length - nextComments.length;

      setCommentCount((currentCount) => Math.max(0, Number(currentCount || 0) - removedCount));
      return nextComments;
    });
    return true;
  }

  async function handleDeletePost() {
    if (!canDelete || deleting || typeof onDeletePost !== "function") {
      return;
    }

    setDeleting(true);
    setDeleteError("");

    try {
      const result = await onDeletePost(id, imageUrl);

      if (result?.success === false || result === false) {
        const errorMessage = result?.error || "Unable to delete post.";
        setDeleteError(errorMessage);
        console.error("Post delete failed:", errorMessage);
      }
    } catch (error) {
      const errorMessage = error?.message || "Unable to delete post.";
      setDeleteError(errorMessage);
      console.error("Post delete failed:", error);
    } finally {
      setDeleting(false);
    }
  }

  async function handleLoveClick() {
    if (!user?.id || loveToggling) {
      return;
    }

    setLoveToggling(true);
    const nextLoved = !hasLoved;
    const nextLoveCount = Math.max(0, currentLoveCount + (nextLoved ? 1 : -1));

    try {
      const { error, summary } = await setPostReaction(id, "love");

      if (error) {
        return;
      }

      setHasLoved(Boolean(summary?.user_reaction ?? nextLoved));
      setCurrentLoveCount(Number(summary?.reactions_count ?? summary?.like_count ?? nextLoveCount));
      if (typeof onReactionUpdated === "function") {
        onReactionUpdated(id, summary || {
          like_count: nextLoveCount,
          reactions_count: nextLoveCount,
          user_reaction: nextLoved ? "love" : null,
        });
      }

      if (nextLoved) {
        setLoveAnimating(true);
        setTimeout(() => setLoveAnimating(false), 260);
      }
    } finally {
      setLoveToggling(false);
    }
  }

  async function handleLoveCountClick() {
    if (!canViewLoveList || !currentLoveCount) {
      return;
    }

    setLoveListOpen(true);
    setLoveListLoading(true);
    setLoveListError("");

    try {
      const rows = await getPostLoves(id);
      setLoveList(rows);
    } catch (error) {
      console.error("Load Post Loves Error:", error);
      setLoveList([]);
      setLoveListError(error?.message || "Unable to load loves.");
    } finally {
      setLoveListLoading(false);
    }
  }

  function handleCommentSheetTouchStart(event) {
    commentSheetTouchStartYRef.current = event.touches[0]?.clientY ?? null;
  }

  function handleCommentSheetTouchEnd(event) {
    const startY = commentSheetTouchStartYRef.current;
    const endY = event.changedTouches[0]?.clientY ?? null;
    commentSheetTouchStartYRef.current = null;

    if (startY === null || endY === null) {
      return;
    }

    if (endY - startY > 70) {
      setCommentOpen(false);
    }
  }

  return (
    <article
      className={`rounded-2xl border p-4 sm:p-6 ${
        isDark ? "border-slate-800 bg-slate-900 shadow-xl" : "border-slate-200 bg-white shadow-sm"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {(() => {
            const displayName = profile?.full_name || authorName || "";
            const displayAvatar = profile?.avatar_url ?? authorAvatar ?? null;
            const initial = (displayName?.charAt(0) || "").toUpperCase();
            const profilePath = !isAnonymous && authorUserId ? getProfilePath(authorUserId, user?.id) : null;

            if (isAnonymous) {
              return (
                <img
                  src={maskedAvatarPath}
                  alt="Masked"
                  className="h-10 w-10 rounded-full object-cover"
                />
              );
            }

            if (displayAvatar) {
              const avatar = (
                <img
                  src={displayAvatar}
                  alt={displayName || "Profile avatar"}
                  className="h-10 w-10 rounded-full object-cover"
                />
              );

              return profilePath ? (
                <Link to={profilePath} aria-label={`Open ${displayName || "user"} profile`} className="shrink-0 cursor-pointer">
                  {avatar}
                </Link>
              ) : (
                avatar
              );
            }

            const avatarFallback = (
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${
                  isDark ? "bg-slate-700 text-white" : "bg-slate-200 text-slate-700"
                }`}
              >
                {initial}
              </div>
            );

            return profilePath ? (
              <Link to={profilePath} aria-label={`Open ${displayName || "user"} profile`} className="shrink-0 cursor-pointer">
                {avatarFallback}
              </Link>
            ) : (
              avatarFallback
            );
          })()}

          {isAnonymous || !authorUserId ? (
            <p className={`truncate text-sm font-medium ${isDark ? "text-slate-200" : "text-slate-900"}`}>
              {isAnonymous ? "Masked" : profile?.full_name || authorName}
            </p>
          ) : (
            <Link
              to={getProfilePath(authorUserId, user?.id)}
              className={`truncate text-sm font-medium transition ${
                isDark ? "text-slate-200 hover:text-sky-300" : "text-slate-900 hover:text-[#c446ff]"
              }`}
            >
              {profile?.full_name || authorName}
            </Link>
          )}
        </div>

        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs ${
            isDark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"
          }`}
        >
          {date}
        </span>
      </div>

      {body ? (
        <p className={`mt-4 whitespace-pre-wrap ${isDark ? "text-slate-300" : "text-slate-700"}`}>
          {body}
        </p>
      ) : null}

      {imageUrl ? (
        <div className="mt-4 overflow-hidden rounded-2xl">
          {isVideoPost ? (
            <FeedVideoPlayer src={mediaUrls[0]} isDark={isDark} />
          ) : (
            <FeedImageCarousel urls={mediaUrls} isDark={isDark} />
          )}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleLoveClick}
            disabled={loveToggling}
            aria-label={hasLoved ? "Remove Love" : "Love post"}
            className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-70 ${
              hasLoved
                ? isDark
                  ? "bg-rose-600 text-white hover:bg-rose-500"
                  : "bg-rose-100 text-rose-700 hover:bg-rose-200"
                : isDark
                  ? "bg-slate-800 text-white hover:bg-rose-600"
                  : "bg-[#f6e8ff] text-[#c446ff] hover:bg-[#edd4ff]"
            }`}
          >
            <span
              className={`inline-block transition-transform duration-200 ${
                loveAnimating ? "scale-150" : "scale-100"
              }`}
            >
              {hasLoved ? "❤️" : "🤍"}
            </span>
          </button>
          {canViewLoveList && currentLoveCount ? (
            <button
              type="button"
              onClick={handleLoveCountClick}
              className={`text-sm font-medium leading-none transition hover:text-[#c446ff] ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              {currentLoveCount}
            </button>
          ) : (
            <span className={`text-sm leading-none ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              {currentLoveCount}
            </span>
          )}
        </div>

        <button
          onClick={() => setCommentOpen(true)}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            isDark
              ? "bg-slate-800 text-white hover:bg-sky-500"
              : "bg-[#f6e8ff] text-[#c446ff] hover:bg-[#edd4ff]"
          }`}
        >
          💬
        </button>

        <span className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          {commentCount} Comments
        </span>

        {canDelete ? (
          <button
            type="button"
            onClick={handleDeletePost}
            disabled={deleting}
            className={`ml-0 rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-70 sm:ml-auto ${
              isDark
                ? "bg-slate-800 text-rose-200 hover:bg-rose-950"
                : "bg-rose-50 text-rose-700 hover:bg-rose-100"
            }`}
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        ) : null}
      </div>

      {deleteError ? (
        <p className={`mt-3 text-sm ${isDark ? "text-rose-300" : "text-rose-700"}`}>
          {deleteError}
        </p>
      ) : null}

      {loveListOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 py-6 sm:items-center">
          <div
            className={`max-h-[80vh] w-full max-w-md overflow-hidden rounded-t-[28px] border shadow-2xl sm:rounded-[28px] ${
              isDark ? "border-slate-800 bg-slate-950 text-slate-100" : "border-slate-200 bg-white text-slate-950"
            }`}
          >
            <div className={`flex items-center justify-between border-b px-5 py-4 ${isDark ? "border-slate-800" : "border-slate-200"}`}>
              <div>
                <h3 className="text-base font-semibold">Loved by</h3>
                <p className={isDark ? "text-xs text-slate-400" : "text-xs text-slate-500"}>
                  {currentLoveCount} {currentLoveCount === 1 ? "person" : "people"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLoveListOpen(false)}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                  isDark ? "bg-slate-900 text-slate-200 hover:bg-slate-800" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Close
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
              {loveListLoading ? (
                <p className={isDark ? "text-sm text-slate-400" : "text-sm text-slate-500"}>Loading loves...</p>
              ) : loveListError ? (
                <p className={isDark ? "text-sm text-rose-300" : "text-sm text-rose-700"}>{loveListError}</p>
              ) : loveList.length ? (
                <div className="space-y-3">
                  {loveList.map((love) => {
                    const profileData = love.profile || {};
                    const displayName = profileData.full_name || profileData.email || "Gemify user";
                    const avatarUrl = profileData.avatar_url || null;
                    const profilePath = getProfilePath(love.user_id, user?.id);

                    return (
                      <div key={love.id} className="flex items-center gap-3">
                        <Link to={profilePath} className="shrink-0 cursor-pointer" onClick={() => setLoveListOpen(false)}>
                          {avatarUrl ? (
                            <img src={avatarUrl} alt={displayName} className="h-11 w-11 rounded-full object-cover" />
                          ) : (
                            <span
                              className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold ${
                                isDark ? "bg-slate-800 text-slate-100" : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {(displayName.charAt(0) || "").toUpperCase()}
                            </span>
                          )}
                        </Link>
                        <div className="min-w-0 flex-1">
                          <Link
                            to={profilePath}
                            onClick={() => setLoveListOpen(false)}
                            className={`block truncate text-sm font-semibold transition ${
                              isDark ? "text-slate-100 hover:text-sky-300" : "text-slate-900 hover:text-[#c446ff]"
                            }`}
                          >
                            {displayName}
                          </Link>
                          <p className={isDark ? "mt-0.5 text-xs text-slate-500" : "mt-0.5 text-xs text-slate-500"}>
                            {love.created_at ? formatRelativeTime(love.created_at) : ""}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className={isDark ? "text-sm text-slate-400" : "text-sm text-slate-500"}>No reactions yet.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {commentOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-end">
          <div
            className={`flex max-h-[80vh] w-full animate-[profile-view-in_180ms_ease-out] flex-col overflow-hidden rounded-t-[28px] border shadow-2xl ${
              isDark ? "border-slate-800 bg-slate-950 text-slate-100" : "border-slate-200 bg-white text-slate-950"
            }`}
            onTouchStart={handleCommentSheetTouchStart}
            onTouchEnd={handleCommentSheetTouchEnd}
          >
            <div className={`shrink-0 border-b px-5 pb-4 pt-3 ${isDark ? "border-slate-800" : "border-slate-200"}`}>
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-500/40" />
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold">Comments</h3>
                  <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    {commentCount} {commentCount === 1 ? "comment" : "comments"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCommentOpen(false)}
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-xl font-semibold transition ${
                    isDark ? "bg-slate-900 text-slate-200 hover:bg-slate-800" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                  aria-label="Close comments"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <CommentList
                comments={comments}
                loading={loadingComments}
                onDeleteComment={handleDeleteComment}
                onReplyComment={setReplyingToComment}
                replyingToCommentId={replyingToComment?.id || ""}
                renderReplyForm={(comment) => (
                  <CommentForm
                    onSubmit={(content, isAnonymous) => handleCommentSubmit(content, isAnonymous, comment.id)}
                    initialContent={comment.is_anonymous ? "" : `@${comment.profile?.full_name || comment.author_name || ""} `}
                    placeholder="Write a reply..."
                    mentionUsers={mentionUsers}
                    onCancel={() => setReplyingToComment(null)}
                  />
                )}
              />
            </div>

            <div className={`relative z-10 shrink-0 border-t px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 ${isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-white"}`}>
              <CommentForm
                onSubmit={(content, isAnonymous) => handleCommentSubmit(content, isAnonymous, null)}
                mentionUsers={mentionUsers}
              />
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export default PostCard;
