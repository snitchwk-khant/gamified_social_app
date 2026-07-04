begin;

alter table public.notifications
add column if not exists notification_group_id uuid,
add column if not exists is_published boolean not null default true,
add column if not exists published_at timestamptz;

update public.notifications
set
  notification_group_id = coalesce(notification_group_id, id),
  is_published = coalesce(is_published, true),
  published_at = case
    when coalesce(is_published, true) then coalesce(published_at, created_at)
    else published_at
  end
where notification_group_id is null
   or published_at is null;

create index if not exists notifications_group_id_idx
on public.notifications(notification_group_id);

create index if not exists notifications_published_idx
on public.notifications(is_published);

select pg_notify('pgrst', 'reload schema');

commit;
