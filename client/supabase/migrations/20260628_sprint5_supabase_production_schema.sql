-- Sprint 5 - Supabase Production Schema + Feature Lock Foundation
-- Supabase-only architecture. No Express/MongoDB dependencies.

begin;

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.role from public.profiles p where p.id = auth.uid()), 'employee');
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'admin';
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Core table: profiles (existing table-safe migration)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  avatar_url text,
  department text,
  position text,
  bio text,
  level int not null default 1,
  xp int not null default 0,
  employee_id text unique,
  phone text,
  birthday date,
  location text,
  skills text,
  role text not null default 'employee' check (role in ('admin', 'hr', 'accountant', 'employee')),
  monthly_target_amount numeric(12,2) not null default 0 check (monthly_target_amount >= 0),
  daily_sales_amount numeric(12,2) not null default 0 check (daily_sales_amount >= 0),
  monthly_sales_accumulated numeric(12,2) not null default 0 check (monthly_sales_accumulated >= 0),
  target_percentage numeric(5,2) generated always as (
    case
      when monthly_target_amount <= 0 then 0
      else least(100, round((monthly_sales_accumulated / monthly_target_amount) * 100, 2))
    end
  ) stored,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists monthly_target_amount numeric(12,2) not null default 0;
alter table public.profiles add column if not exists daily_sales_amount numeric(12,2) not null default 0;
alter table public.profiles add column if not exists monthly_sales_accumulated numeric(12,2) not null default 0;
alter table public.profiles add column if not exists is_active boolean not null default true;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists profiles_department_idx on public.profiles(department);

-- -----------------------------------------------------------------------------
-- Feed tables
-- -----------------------------------------------------------------------------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  image_url text,
  is_anonymous boolean not null default false,
  comments_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists posts_user_id_idx on public.posts(user_id);
create index if not exists posts_created_at_idx on public.posts(created_at desc);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  is_anonymous boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists comments_post_id_idx on public.comments(post_id);
create index if not exists comments_user_id_idx on public.comments(user_id);
create index if not exists comments_created_at_idx on public.comments(created_at asc);

create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint likes_target_check check (
    (post_id is not null and comment_id is null) or
    (post_id is null and comment_id is not null)
  )
);

create unique index if not exists likes_user_post_uidx
  on public.likes(user_id, post_id)
  where post_id is not null;

create unique index if not exists likes_user_comment_uidx
  on public.likes(user_id, comment_id)
  where comment_id is not null;

-- -----------------------------------------------------------------------------
-- Stories / chat / notifications / announcements
-- -----------------------------------------------------------------------------
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text,
  image_url text,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stories_payload_check check (coalesce(content, '') <> '' or image_url is not null)
);

create index if not exists stories_user_id_idx on public.stories(user_id);
create index if not exists stories_expires_at_idx on public.stories(expires_at);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint messages_sender_receiver_check check (sender_id <> receiver_id)
);

create index if not exists messages_sender_id_idx on public.messages(sender_id);
create index if not exists messages_receiver_id_idx on public.messages(receiver_id);
create index if not exists messages_created_at_idx on public.messages(created_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null,
  title text not null,
  body text,
  metadata jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on public.notifications(user_id);
create index if not exists notifications_created_at_idx on public.notifications(created_at desc);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  audience_roles text[] not null default array['employee','hr','accountant','admin']::text[],
  is_pinned boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists announcements_created_at_idx on public.announcements(created_at desc);

-- -----------------------------------------------------------------------------
-- Admin config and feature locks
-- -----------------------------------------------------------------------------
create table if not exists public.admin_configs (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null default '{}'::jsonb,
  description text,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.admin_configs (key, value, description)
values
  ('feature_locks', '{
    "posting": {"enabled": true, "minTargetPercentage": 0, "allowedRoles": ["admin", "hr", "accountant", "employee"]},
    "commenting": {"enabled": true, "minTargetPercentage": 0, "allowedRoles": ["admin", "hr", "accountant", "employee"]},
    "stories": {"enabled": true, "minTargetPercentage": 0, "allowedRoles": ["admin", "hr", "accountant", "employee"]},
    "chat": {"enabled": true, "minTargetPercentage": 0, "allowedRoles": ["admin", "hr", "accountant", "employee"]},
    "announcements": {"enabled": true, "allowedRoles": ["admin", "hr"]},
    "sales_updates": {"enabled": true, "allowedRoles": ["admin", "accountant"]}
  }'::jsonb, 'Global feature lock rules')
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Sales updates (accountant/admin)
-- -----------------------------------------------------------------------------
create table if not exists public.sales_updates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  updated_by uuid not null references public.profiles(id) on delete cascade,
  sales_date date not null default current_date,
  daily_sales_amount numeric(12,2) not null default 0 check (daily_sales_amount >= 0),
  monthly_sales_accumulated numeric(12,2) not null default 0 check (monthly_sales_accumulated >= 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, sales_date)
);

create index if not exists sales_updates_user_id_idx on public.sales_updates(user_id);
create index if not exists sales_updates_sales_date_idx on public.sales_updates(sales_date desc);

create or replace function public.apply_sales_update_to_profile()
returns trigger
language plpgsql
as $$
begin
  update public.profiles
  set
    daily_sales_amount = new.daily_sales_amount,
    monthly_sales_accumulated = new.monthly_sales_accumulated,
    updated_at = now()
  where id = new.user_id;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Timestamp + counter triggers
-- -----------------------------------------------------------------------------
drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists posts_touch_updated_at on public.posts;
create trigger posts_touch_updated_at
before update on public.posts
for each row execute function public.touch_updated_at();

drop trigger if exists comments_touch_updated_at on public.comments;
create trigger comments_touch_updated_at
before update on public.comments
for each row execute function public.touch_updated_at();

drop trigger if exists stories_touch_updated_at on public.stories;
create trigger stories_touch_updated_at
before update on public.stories
for each row execute function public.touch_updated_at();

drop trigger if exists messages_touch_updated_at on public.messages;
create trigger messages_touch_updated_at
before update on public.messages
for each row execute function public.touch_updated_at();

drop trigger if exists notifications_touch_updated_at on public.notifications;
create trigger notifications_touch_updated_at
before update on public.notifications
for each row execute function public.touch_updated_at();

drop trigger if exists announcements_touch_updated_at on public.announcements;
create trigger announcements_touch_updated_at
before update on public.announcements
for each row execute function public.touch_updated_at();

drop trigger if exists admin_configs_touch_updated_at on public.admin_configs;
create trigger admin_configs_touch_updated_at
before update on public.admin_configs
for each row execute function public.touch_updated_at();

drop trigger if exists sales_updates_touch_updated_at on public.sales_updates;
create trigger sales_updates_touch_updated_at
before update on public.sales_updates
for each row execute function public.touch_updated_at();

drop trigger if exists sales_updates_apply_profile_trigger on public.sales_updates;
create trigger sales_updates_apply_profile_trigger
after insert or update on public.sales_updates
for each row execute function public.apply_sales_update_to_profile();

create or replace function public.bump_post_comments_count()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts
    set comments_count = comments_count + 1
    where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.posts
    set comments_count = greatest(0, comments_count - 1)
    where id = old.post_id;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists comments_bump_post_count_insert on public.comments;
create trigger comments_bump_post_count_insert
after insert on public.comments
for each row execute function public.bump_post_comments_count();

drop trigger if exists comments_bump_post_count_delete on public.comments;
create trigger comments_bump_post_count_delete
after delete on public.comments
for each row execute function public.bump_post_comments_count();

-- -----------------------------------------------------------------------------
-- Storage buckets
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('post-images', 'post-images', true),
  ('story-images', 'story-images', true)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.stories enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.announcements enable row level security;
alter table public.admin_configs enable row level security;
alter table public.sales_updates enable row level security;

-- Profiles
create policy "profiles_select_authenticated"
on public.profiles for select
to authenticated
using (true);

create policy "profiles_insert_self"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

create policy "profiles_update_self_or_admin"
on public.profiles for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

-- Posts
create policy "posts_select_authenticated"
on public.posts for select
to authenticated
using (true);

create policy "posts_insert_own"
on public.posts for insert
to authenticated
with check (user_id = auth.uid());

create policy "posts_update_own_or_admin"
on public.posts for update
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

create policy "posts_delete_own_or_admin"
on public.posts for delete
to authenticated
using (user_id = auth.uid() or public.is_admin());

-- Comments
create policy "comments_select_authenticated"
on public.comments for select
to authenticated
using (true);

create policy "comments_insert_own"
on public.comments for insert
to authenticated
with check (user_id = auth.uid());

create policy "comments_update_own_or_admin"
on public.comments for update
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

create policy "comments_delete_own_or_admin"
on public.comments for delete
to authenticated
using (user_id = auth.uid() or public.is_admin());

-- Likes
create policy "likes_select_authenticated"
on public.likes for select
to authenticated
using (true);

create policy "likes_insert_own"
on public.likes for insert
to authenticated
with check (user_id = auth.uid());

create policy "likes_delete_own_or_admin"
on public.likes for delete
to authenticated
using (user_id = auth.uid() or public.is_admin());

-- Stories
create policy "stories_select_authenticated"
on public.stories for select
to authenticated
using (expires_at > now());

create policy "stories_insert_own"
on public.stories for insert
to authenticated
with check (user_id = auth.uid());

create policy "stories_update_own_or_admin"
on public.stories for update
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

create policy "stories_delete_own_or_admin"
on public.stories for delete
to authenticated
using (user_id = auth.uid() or public.is_admin());

-- Messages
create policy "messages_select_participants"
on public.messages for select
to authenticated
using (sender_id = auth.uid() or receiver_id = auth.uid());

create policy "messages_insert_sender"
on public.messages for insert
to authenticated
with check (sender_id = auth.uid());

create policy "messages_update_participants"
on public.messages for update
to authenticated
using (sender_id = auth.uid() or receiver_id = auth.uid())
with check (sender_id = auth.uid() or receiver_id = auth.uid());

-- Notifications
create policy "notifications_select_own_or_admin"
on public.notifications for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "notifications_insert_admin_or_hr"
on public.notifications for insert
to authenticated
with check (public.current_user_role() in ('admin', 'hr') or user_id = auth.uid());

create policy "notifications_update_own_or_admin"
on public.notifications for update
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

-- Announcements
create policy "announcements_select_authenticated"
on public.announcements for select
to authenticated
using (true);

create policy "announcements_write_admin_hr"
on public.announcements for all
to authenticated
using (public.current_user_role() in ('admin', 'hr'))
with check (public.current_user_role() in ('admin', 'hr'));

-- Admin configs
create policy "admin_configs_select_authenticated"
on public.admin_configs for select
to authenticated
using (true);

create policy "admin_configs_write_admin"
on public.admin_configs for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Sales updates
create policy "sales_updates_select_roles"
on public.sales_updates for select
to authenticated
using (
  public.current_user_role() in ('admin', 'hr', 'accountant')
  or user_id = auth.uid()
);

create policy "sales_updates_write_accountant_or_admin"
on public.sales_updates for insert
to authenticated
with check (public.current_user_role() in ('admin', 'accountant'));

create policy "sales_updates_update_accountant_or_admin"
on public.sales_updates for update
to authenticated
using (public.current_user_role() in ('admin', 'accountant'))
with check (public.current_user_role() in ('admin', 'accountant'));

-- Storage object policies
create policy "storage_public_read"
on storage.objects for select
using (bucket_id in ('avatars', 'post-images', 'story-images'));

create policy "avatars_upload_own_folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy "avatars_update_delete_own_folder"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy "avatars_delete_own_folder"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy "post_images_upload_own_folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'post-images'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy "story_images_upload_own_folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'story-images'
  and split_part(name, '/', 1) = auth.uid()::text
);

commit;
