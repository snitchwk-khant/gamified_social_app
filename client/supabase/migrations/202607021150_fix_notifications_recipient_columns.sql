begin;

alter table public.notifications
add column if not exists recipient_type text not null default 'user',
add column if not exists recipient_id uuid,
add column if not exists message text,
add column if not exists category text not null default 'System',
add column if not exists priority text not null default 'normal',
add column if not exists created_by uuid references public.profiles(id) on delete set null,
add column if not exists notification_group_id uuid,
add column if not exists is_published boolean not null default true,
add column if not exists published_at timestamptz;

update public.notifications
set
  recipient_type = coalesce(nullif(recipient_type, ''), 'user'),
  recipient_id = coalesce(recipient_id, user_id),
  message = coalesce(message, body, ''),
  category = coalesce(nullif(category, ''), nullif(type, ''), 'System'),
  priority = coalesce(nullif(priority, ''), 'normal'),
  notification_group_id = coalesce(notification_group_id, id),
  is_published = coalesce(is_published, true),
  published_at = case
    when coalesce(is_published, true) then coalesce(published_at, created_at)
    else published_at
  end
where recipient_id is null
   or message is null
   or category is null
   or priority is null
   or notification_group_id is null
   or published_at is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'notifications_recipient_type_check'
      and conrelid = 'public.notifications'::regclass
  ) then
    alter table public.notifications
    add constraint notifications_recipient_type_check
    check (recipient_type in ('everyone', 'user', 'shop'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'notifications_priority_check'
      and conrelid = 'public.notifications'::regclass
  ) then
    alter table public.notifications
    add constraint notifications_priority_check
    check (priority in ('normal', 'high', 'urgent'));
  end if;
end $$;

create index if not exists notifications_recipient_idx
on public.notifications(recipient_type, recipient_id);

create index if not exists notifications_group_id_idx
on public.notifications(notification_group_id);

create index if not exists notifications_published_idx
on public.notifications(is_published);

select pg_notify('pgrst', 'reload schema');

commit;
