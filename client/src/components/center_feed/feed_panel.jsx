import PostCard from "./post_card";

function FeedPanel({ posts }) {
  return (
    <div className="space-y-6">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          id={post.id}
          title={post.title}
          body={post.body}
          date={post.date}
          commentsCount={post.comments_count}
          isAnonymous={post.is_anonymous}
          authorName={post.author_name}
          authorAvatar={post.author_avatar}
        />
      ))}
    </div>
  );
}

export default FeedPanel;