begin;

alter table public.comments
add column if not exists parent_comment_id uuid references public.comments(id) on delete cascade;

create index if not exists comments_parent_comment_id_idx
on public.comments(parent_comment_id);

create or replace function public.create_comment_notification(
  target_user_id uuid,
  notification_title text,
  notification_message text,
  source_post_id uuid,
  source_comment_id uuid,
  notification_category text default 'Mention'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_notification_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if target_user_id is null or target_user_id = auth.uid() then
    return null;
  end if;

  insert into public.notifications (
    user_id,
    recipient_type,
    recipient_id,
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
    coalesce(nullif(notification_title, ''), 'Notification'),
    coalesce(notification_message, ''),
    coalesce(notification_message, ''),
    coalesce(nullif(notification_category, ''), 'Mention'),
    coalesce(nullif(notification_category, ''), 'Mention'),
    'normal',
    auth.uid(),
    true,
    now(),
    false,
    jsonb_build_object(
      'action_url', '/',
      'post_id', source_post_id,
      'comment_id', source_comment_id
    )
  )
  returning id into new_notification_id;

  return new_notification_id;
end;
$$;

grant execute on function public.create_comment_notification(uuid, text, text, uuid, uuid, text) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'comments'
  ) then
    alter publication supabase_realtime add table public.comments;
  end if;
end $$;

select pg_notify('pgrst', 'reload schema');

commit;
