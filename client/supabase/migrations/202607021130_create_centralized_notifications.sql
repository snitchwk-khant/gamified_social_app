begin;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null default 'System',
  title text not null,
  body text,
  metadata jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notifications
add column if not exists user_id uuid references public.profiles(id) on delete cascade,
add column if not exists actor_id uuid references public.profiles(id) on delete set null,
add column if not exists type text not null default 'System',
add column if not exists title text,
add column if not exists body text,
add column if not exists message text,
add column if not exists category text not null default 'System',
add column if not exists recipient_type text not null default 'user',
add column if not exists recipient_id uuid,
add column if not exists priority text not null default 'normal',
add column if not exists is_read boolean not null default false,
add column if not exists created_by uuid references public.profiles(id) on delete set null,
add column if not exists metadata jsonb not null default '{}'::jsonb,
add column if not exists created_at timestamptz not null default now(),
add column if not exists updated_at timestamptz not null default now();

update public.notifications
set
  title = coalesce(nullif(title, ''), 'Notification'),
  type = coalesce(nullif(type, ''), 'System'),
  category = coalesce(nullif(category, ''), nullif(type, ''), 'System'),
  message = coalesce(message, body, ''),
  priority = coalesce(nullif(priority, ''), 'normal'),
  recipient_type = coalesce(nullif(recipient_type, ''), 'user'),
  recipient_id = coalesce(recipient_id, user_id)
where category is null
   or message is null
   or title is null
   or type is null
   or priority is null
   or recipient_type is null
   or recipient_id is null;

alter table public.notifications
alter column title set not null,
alter column type set default 'System',
alter column category set default 'System',
alter column recipient_type set default 'user',
alter column priority set default 'normal';

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

create index if not exists notifications_user_id_idx on public.notifications(user_id);
create index if not exists notifications_created_at_idx on public.notifications(created_at desc);
create index if not exists notifications_is_read_idx on public.notifications(is_read);
create index if not exists notifications_category_idx on public.notifications(category);
create index if not exists notifications_recipient_idx on public.notifications(recipient_type, recipient_id);

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own_or_admin" on public.notifications;
drop policy if exists "notifications_insert_admin_or_hr" on public.notifications;
drop policy if exists "notifications_update_own_or_admin" on public.notifications;
drop policy if exists "notifications_delete_admin" on public.notifications;
drop policy if exists "notifications_select_addressed_or_admin" on public.notifications;
drop policy if exists "notifications_insert_admin" on public.notifications;
drop policy if exists "notifications_update_addressed_or_admin" on public.notifications;

create policy "notifications_select_addressed_or_admin"
on public.notifications
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
  or user_id = auth.uid()
  or (
    recipient_type = 'user'
    and recipient_id = auth.uid()
  )
);

create policy "notifications_insert_admin"
on public.notifications
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

create policy "notifications_update_addressed_or_admin"
on public.notifications
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
  or user_id = auth.uid()
  or (
    recipient_type = 'user'
    and recipient_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
  or user_id = auth.uid()
  or (
    recipient_type = 'user'
    and recipient_id = auth.uid()
  )
);

create policy "notifications_delete_admin"
on public.notifications
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

grant select, insert, update, delete on public.notifications to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

select pg_notify('pgrst', 'reload schema');

commit;
