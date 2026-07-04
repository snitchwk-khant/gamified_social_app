import PostCard from "./post_card";

function FeedPanel({ posts, onCommentCreated, onDeletePost }) {
  return (
    <div className="space-y-6">
      {posts.map((post) => (
        <PostCard
          key={post.id}
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
          userReaction={post.user_reaction}
          onCommentCreated={onCommentCreated}
          onDeletePost={onDeletePost}
        />
      ))}
    </div>
  );
}

export default FeedPanel;
