begin;

alter table public.notifications
add column if not exists actor_id uuid references public.profiles(id) on delete set null,
add column if not exists post_id uuid references public.posts(id) on delete cascade,
add column if not exists comment_id uuid references public.comments(id) on delete cascade;

create index if not exists notifications_actor_id_idx
on public.notifications(actor_id);

create index if not exists notifications_post_id_idx
on public.notifications(post_id);

create index if not exists notifications_comment_id_idx
on public.notifications(comment_id);

create unique index if not exists notifications_unique_post_reaction_idx
on public.notifications(type, actor_id, recipient_id, post_id)
where type = 'post_reaction';

create unique index if not exists notifications_unique_comment_interaction_idx
on public.notifications(type, comment_id)
where type in ('post_comment', 'comment_reply') and comment_id is not null;

create or replace function public.create_social_notification(
  target_user_id uuid,
  notification_type text,
  source_post_id uuid,
  source_comment_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_notification_id uuid;
  new_notification_id uuid;
  actor_name text;
  notification_title text;
  notification_body text;
  comment_preview text;
  notification_action_url text;
  verified_recipient_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if target_user_id is null or target_user_id = auth.uid() then
    return null;
  end if;

  if notification_type not in ('post_reaction', 'post_comment', 'comment_reply') then
    raise exception 'Unsupported notification type: %', notification_type;
  end if;

  if source_post_id is null then
    raise exception 'source_post_id is required';
  end if;

  if notification_type in ('post_comment', 'comment_reply') and source_comment_id is null then
    raise exception 'source_comment_id is required for comment notifications';
  end if;

  select coalesce(nullif(p.full_name, ''), split_part(p.email, '@', 1), 'Someone')
  into actor_name
  from public.profiles p
  where p.id = auth.uid();

  actor_name := coalesce(nullif(actor_name, ''), 'Someone');

  if notification_type = 'post_reaction' then
    select posts.user_id
    into verified_recipient_id
    from public.posts
    inner join public.post_reactions
      on post_reactions.post_id = posts.id
     and post_reactions.user_id = auth.uid()
     and post_reactions.reaction = 'love'
    where posts.id = source_post_id;

    if verified_recipient_id is distinct from target_user_id then
      raise exception 'Invalid reaction notification target';
    end if;

    select id
    into existing_notification_id
    from public.notifications
    where type = notification_type
      and actor_id = auth.uid()
      and recipient_id = target_user_id
      and post_id = source_post_id
    limit 1;

    notification_title := '❤️ ' || actor_name || ' reacted to your post.';
    notification_body := notification_title;
    notification_action_url := '/home?post=' || source_post_id::text;
  elsif notification_type = 'post_comment' then
    select posts.user_id, left(nullif(trim(comments.content), ''), 160)
    into verified_recipient_id, comment_preview
    from public.posts
    inner join public.comments
      on comments.post_id = posts.id
     and comments.id = source_comment_id
     and comments.user_id = auth.uid()
     and comments.parent_comment_id is null
    where posts.id = source_post_id;

    if verified_recipient_id is distinct from target_user_id then
      raise exception 'Invalid comment notification target';
    end if;

    select id
    into existing_notification_id
    from public.notifications
    where type = notification_type
      and comment_id = source_comment_id
    limit 1;

    notification_title := '💬 ' || actor_name || ' commented on your post.';
    notification_body := coalesce(comment_preview, notification_title);
    notification_action_url := '/home?post=' || source_post_id::text || '&comments=1';
  else
    select parent_comments.user_id, left(nullif(trim(replies.content), ''), 160)
    into verified_recipient_id, comment_preview
    from public.comments replies
    inner join public.comments parent_comments
      on parent_comments.id = replies.parent_comment_id
    where replies.id = source_comment_id
      and replies.post_id = source_post_id
      and replies.user_id = auth.uid();

    if verified_recipient_id is distinct from target_user_id then
      raise exception 'Invalid reply notification target';
    end if;

    select id
    into existing_notification_id
    from public.notifications
    where type = notification_type
      and comment_id = source_comment_id
    limit 1;

    notification_title := '↩️ ' || actor_name || ' replied to your comment.';
    notification_body := coalesce(comment_preview, notification_title);
    notification_action_url := '/home?post=' || source_post_id::text || '&comments=1&comment=' || source_comment_id::text;
  end if;

  if existing_notification_id is not null then
    return existing_notification_id;
  end if;

  insert into public.notifications (
    user_id,
    recipient_type,
    recipient_id,
    actor_id,
    post_id,
    comment_id,
    title,
    body,
    message,
    type,
    category,
    priority,
    created_by,
    is_published,
    published_at,
    is_read,
    metadata
  )
  values (
    target_user_id,
    'user',
    target_user_id,
    auth.uid(),
    source_post_id,
    source_comment_id,
    notification_title,
    notification_body,
    notification_body,
    notification_type,
    'Social',
    'normal',
    auth.uid(),
    true,
    now(),
    false,
    jsonb_build_object(
      'action_url', notification_action_url,
      'post_id', source_post_id,
      'comment_id', source_comment_id,
      'comment_preview', comment_preview,
      'actor_id', auth.uid(),
      'type', notification_type
    )
  )
  returning id into new_notification_id;

  return new_notification_id;
end;
$$;

grant execute on function public.create_social_notification(uuid, text, uuid, uuid) to authenticated;

select pg_notify('pgrst', 'reload schema');

commit;
