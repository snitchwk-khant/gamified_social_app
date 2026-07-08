begin;

create or replace function public.create_comment_mention_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
  notification_title text;
  notification_body text;
begin
  select coalesce(nullif(profile.full_name, ''), split_part(profile.email, '@', 1), 'Someone')
  into actor_name
  from public.profiles profile
  where profile.id = new.user_id;

  notification_title := '👤 ' || coalesce(actor_name, 'Someone') || ' mentioned you.';
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
  select distinct
    mentioned_profile.id,
    'user',
    mentioned_profile.id,
    new.user_id,
    'comment',
    new.id,
    notification_title,
    notification_body,
    notification_body,
    'mention',
    'Social',
    'normal',
    false,
    now()
  from public.profiles mentioned_profile
  where mentioned_profile.id <> new.user_id
    and (
      (
        nullif(mentioned_profile.full_name, '') is not null
        and lower(new.content) like '%' || lower('@' || mentioned_profile.full_name) || '%'
      )
      or (
        nullif(mentioned_profile.full_name, '') is not null
        and lower(new.content) like '%' || lower('@' || replace(mentioned_profile.full_name, ' ', '')) || '%'
      )
      or (
        nullif(mentioned_profile.email, '') is not null
        and lower(new.content) like '%' || lower('@' || split_part(mentioned_profile.email, '@', 1)) || '%'
      )
    )
    and not exists (
      select 1
      from public.notifications existing
      where existing.type = 'mention'
        and existing.recipient_id = mentioned_profile.id
        and existing.actor_id = new.user_id
        and existing.entity_type = 'comment'
        and existing.entity_id = new.id
    );

  return new;
end;
$$;

drop trigger if exists comments_create_mention_notification on public.comments;

create trigger comments_create_mention_notification
after insert on public.comments
for each row
execute function public.create_comment_mention_notification();

select pg_notify('pgrst', 'reload schema');

commit;
