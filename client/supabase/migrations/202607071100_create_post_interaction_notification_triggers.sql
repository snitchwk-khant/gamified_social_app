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

create or replace function public.create_post_reaction_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient_user_id uuid;
  actor_name text;
  notification_title text;
  notification_action_url text;
begin
  select p.user_id
  into recipient_user_id
  from public.posts p
  where p.id = new.post_id;

  if recipient_user_id is null or recipient_user_id = new.user_id then
    return new;
  end if;

  select coalesce(nullif(actor.full_name, ''), split_part(actor.email, '@', 1), 'Someone')
  into actor_name
  from public.profiles actor
  where actor.id = new.user_id;

  actor_name := coalesce(nullif(actor_name, ''), 'Someone');
  notification_title := '❤️ ' || actor_name || ' reacted to your post.';
  notification_action_url := '/home?post=' || new.post_id::text;

  insert into public.notifications (
    user_id,
    recipient_type,
    recipient_id,
    actor_id,
    post_id,
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
    recipient_user_id,
    'user',
    recipient_user_id,
    new.user_id,
    new.post_id,
    notification_title,
    notification_title,
    notification_title,
    'post_reaction',
    'Social',
    'normal',
    new.user_id,
    true,
    now(),
    false,
    jsonb_build_object(
      'action_url', notification_action_url,
      'post_id', new.post_id,
      'actor_id', new.user_id,
      'type', 'post_reaction'
    )
  )
  on conflict do nothing;

  return new;
end;
$$;

create or replace function public.create_post_comment_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient_user_id uuid;
  actor_name text;
  notification_title text;
  comment_preview text;
  notification_body text;
  notification_action_url text;
begin
  if new.parent_comment_id is not null then
    return new;
  end if;

  select p.user_id
  into recipient_user_id
  from public.posts p
  where p.id = new.post_id;

  if recipient_user_id is null or recipient_user_id = new.user_id then
    return new;
  end if;

  select coalesce(nullif(actor.full_name, ''), split_part(actor.email, '@', 1), 'Someone')
  into actor_name
  from public.profiles actor
  where actor.id = new.user_id;

  actor_name := coalesce(nullif(actor_name, ''), 'Someone');
  notification_title := '💬 ' || actor_name || ' commented on your post.';
  comment_preview := left(nullif(trim(new.content), ''), 160);
  notification_body := coalesce(comment_preview, notification_title);
  notification_action_url := '/home?post=' || new.post_id::text || '&comments=1&comment=' || new.id::text;

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
    recipient_user_id,
    'user',
    recipient_user_id,
    new.user_id,
    new.post_id,
    new.id,
    notification_title,
    notification_body,
    notification_body,
    'post_comment',
    'Social',
    'normal',
    new.user_id,
    true,
    now(),
    false,
    jsonb_build_object(
      'action_url', notification_action_url,
      'post_id', new.post_id,
      'comment_id', new.id,
      'comment_preview', comment_preview,
      'actor_id', new.user_id,
      'type', 'post_comment'
    )
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists post_reactions_create_notification on public.post_reactions;
create trigger post_reactions_create_notification
after insert on public.post_reactions
for each row
execute function public.create_post_reaction_notification();

drop trigger if exists comments_create_post_notification on public.comments;
create trigger comments_create_post_notification
after insert on public.comments
for each row
execute function public.create_post_comment_notification();

select pg_notify('pgrst', 'reload schema');

commit;
