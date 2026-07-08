import PostCard from "./post_card";
import { useEffect, useRef } from "react";

function FeedPanel({
  posts,
  onCommentCreated,
  onDeletePost,
  onReactionUpdated,
  focusedPostId = "",
  focusedCommentId = "",
  shouldOpenFocusedComments = false,
}) {
  const postRefs = useRef({});

  useEffect(() => {
    if (!focusedPostId) {
      return;
    }

    requestAnimationFrame(() => {
      postRefs.current[focusedPostId]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  }, [focusedPostId, posts.length]);

  return (
    <div className="divide-y divide-slate-500/20">
      {posts.map((post) => (
        <div
          key={post.id}
          ref={(node) => {
            if (node) {
              postRefs.current[post.id] = node;
            } else {
              delete postRefs.current[post.id];
            }
          }}
        >
          <PostCard
            id={post.id}
            body={post.body}
            date={post.date}
            commentsCount={post.comments_count}
            isAnonymous={post.is_anonymous}
            authorUserId={post.user_id}
            authorName={post.author_name}
            authorAvatar={post.author_avatar}
            imageUrl={post.image_url}
            profile={post.profile}
            likeCount={post.like_count}
            reactionsCount={post.reactions_count}
            userReaction={post.user_reaction}
            onCommentCreated={onCommentCreated}
            onDeletePost={onDeletePost}
            onReactionUpdated={onReactionUpdated}
            initialCommentOpen={shouldOpenFocusedComments && focusedPostId === post.id}
            focusedCommentId={focusedPostId === post.id ? focusedCommentId : ""}
          />
        </div>
      ))}
    </div>
  );
}

export default FeedPanel;
