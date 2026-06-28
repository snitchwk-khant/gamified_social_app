import PostCard from "./post_card";

function FeedPanel({ posts, onCommentCreated }) {
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
          profile={post.profile}
          onCommentCreated={onCommentCreated}
        />
      ))}
    </div>
  );
}

export default FeedPanel;
