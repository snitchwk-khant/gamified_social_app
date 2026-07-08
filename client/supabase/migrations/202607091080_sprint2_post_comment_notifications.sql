begin;

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
  notification_body text;
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

  select coalesce(nullif(profile.full_name, ''), split_part(profile.email, '@', 1), 'Someone')
  into actor_name
  from public.profiles profile
  where profile.id = new.user_id;

  notification_title := '💬 ' || coalesce(actor_name, 'Someone') || ' commented on your post.';
  notification_body := left(coalesce(new.content, ''), 80);

  insert into public.notifications (
    user_id,
    recipient_type,
    recipient_id,
    actor_id,
    entity_type,
    entity_id,
    title,
    body,
    message,
    type,
    category,
    priority,
    is_read,
    created_at
  )
  select
    recipient_user_id,
    'user',
    recipient_user_id,
    new.user_id,
    'post',
    new.post_id,
    notification_title,
    notification_body,
    notification_body,
    'post_comment',
    'Social',
    'normal',
    false,
    now()
  where not exists (
    select 1
    from public.notifications existing
    where existing.type = 'post_comment'
      and existing.recipient_id = recipient_user_id
      and existing.actor_id = new.user_id
      and existing.entity_type = 'post'
      and existing.entity_id = new.post_id
      and existing.message = notification_body
  );

  return new;
end;
$$;

drop trigger if exists comments_create_post_notification on public.comments;

create trigger comments_create_post_notification
after insert on public.comments
for each row
execute function public.create_post_comment_notification();

select pg_notify('pgrst', 'reload schema');

commit;
