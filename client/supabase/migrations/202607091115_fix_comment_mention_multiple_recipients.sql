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

  with mentioned_usernames as (
    select distinct lower(match[1]) as username
    from regexp_matches(coalesce(new.content, ''), '@([A-Za-z0-9_.-]+)', 'g') as match
  ),
  mentioned_profiles as (
    select distinct profile.id
    from mentioned_usernames mentioned
    join public.profiles profile
      on lower(split_part(coalesce(profile.email, ''), '@', 1)) = mentioned.username
      or lower(regexp_replace(coalesce(profile.full_name, ''), '\s+', '', 'g')) = mentioned.username
    where profile.id <> new.user_id
  )
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
  from mentioned_profiles mentioned_profile
  where not exists (
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
