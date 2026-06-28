-- Add only missing Supabase tables:
-- stories, announcements, admin_configs, sales_updates
-- This migration does not recreate existing tables, does not drop tables, and does not delete data.

begin;

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- stories (My Day media with expiry)
-- -----------------------------------------------------------------------------
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  media_url text not null,
  media_type text not null default 'image' check (media_type in ('image', 'video')),
  caption text,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stories_user_id_idx on public.stories(user_id);
create index if not exists stories_expires_at_idx on public.stories(expires_at);
create index if not exists stories_created_at_idx on public.stories(created_at desc);

-- -----------------------------------------------------------------------------
-- announcements (HR/Admin pinned notices)
-- -----------------------------------------------------------------------------
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  is_pinned boolean not null default false,
  audience_roles text[] not null default array['employee','hr','accountant','admin']::text[],
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists announcements_created_by_idx on public.announcements(created_by);
create index if not exists announcements_is_pinned_idx on public.announcements(is_pinned);
create index if not exists announcements_created_at_idx on public.announcements(created_at desc);

-- -----------------------------------------------------------------------------
-- admin_configs (feature lock rules)
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

create index if not exists admin_configs_updated_by_idx on public.admin_configs(updated_by);
create index if not exists admin_configs_value_gin_idx on public.admin_configs using gin (value);

insert into public.admin_configs (key, value, description)
values (
  'feature_locks',
  '{
    "posting": {"enabled": true, "allowedRoles": ["admin", "hr", "accountant", "employee"], "minTargetPercentage": 0},
    "commenting": {"enabled": true, "allowedRoles": ["admin", "hr", "accountant", "employee"], "minTargetPercentage": 0},
    "stories": {"enabled": true, "allowedRoles": ["admin", "hr", "accountant", "employee"], "minTargetPercentage": 0},
    "announcements": {"enabled": true, "allowedRoles": ["admin", "hr"]},
    "sales_updates": {"enabled": true, "allowedRoles": ["admin", "accountant"]}
  }'::jsonb,
  'Global feature lock configuration'
)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- sales_updates (target system inputs)
-- -----------------------------------------------------------------------------
create table if not exists public.sales_updates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0),
  sales_date date not null default current_date,
  created_by uuid not null references public.profiles(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sales_updates_user_id_idx on public.sales_updates(user_id);
create index if not exists sales_updates_sales_date_idx on public.sales_updates(sales_date desc);
create index if not exists sales_updates_created_by_idx on public.sales_updates(created_by);
create index if not exists sales_updates_user_date_idx on public.sales_updates(user_id, sales_date desc);

-- -----------------------------------------------------------------------------
-- updated_at helper trigger (safe re-create)
-- -----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists stories_touch_updated_at on public.stories;
create trigger stories_touch_updated_at
before update on public.stories
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

-- -----------------------------------------------------------------------------
-- Enable RLS
-- -----------------------------------------------------------------------------
alter table public.stories enable row level security;
alter table public.announcements enable row level security;
alter table public.admin_configs enable row level security;
alter table public.sales_updates enable row level security;

-- -----------------------------------------------------------------------------
-- RLS Policies (created only if missing)
-- -----------------------------------------------------------------------------

-- stories: authenticated users can read active stories; users can manage own stories

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'stories' and policyname = 'stories_select_authenticated_active'
  ) then
    execute 'create policy stories_select_authenticated_active on public.stories for select to authenticated using (expires_at > now())';
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'stories' and policyname = 'stories_insert_own'
  ) then
    execute 'create policy stories_insert_own on public.stories for insert to authenticated with check (user_id = auth.uid())';
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'stories' and policyname = 'stories_update_own'
  ) then
    execute 'create policy stories_update_own on public.stories for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())';
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'stories' and policyname = 'stories_delete_own'
  ) then
    execute 'create policy stories_delete_own on public.stories for delete to authenticated using (user_id = auth.uid())';
  end if;
end
$$;

-- announcements: authenticated users can read; only admin/hr can write

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'announcements' and policyname = 'announcements_select_authenticated'
  ) then
    execute 'create policy announcements_select_authenticated on public.announcements for select to authenticated using (true)';
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'announcements' and policyname = 'announcements_insert_hr_admin'
  ) then
    execute $policy$
      create policy announcements_insert_hr_admin
      on public.announcements
      for insert
      to authenticated
      with check (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.role in ('admin', 'hr')
        )
      )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'announcements' and policyname = 'announcements_update_hr_admin'
  ) then
    execute $policy$
      create policy announcements_update_hr_admin
      on public.announcements
      for update
      to authenticated
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.role in ('admin', 'hr')
        )
      )
      with check (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.role in ('admin', 'hr')
        )
      )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'announcements' and policyname = 'announcements_delete_hr_admin'
  ) then
    execute $policy$
      create policy announcements_delete_hr_admin
      on public.announcements
      for delete
      to authenticated
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.role in ('admin', 'hr')
        )
      )
    $policy$;
  end if;
end
$$;

-- admin_configs: authenticated users can read feature config; only admin can write

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'admin_configs' and policyname = 'admin_configs_select_authenticated'
  ) then
    execute 'create policy admin_configs_select_authenticated on public.admin_configs for select to authenticated using (true)';
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'admin_configs' and policyname = 'admin_configs_insert_admin'
  ) then
    execute $policy$
      create policy admin_configs_insert_admin
      on public.admin_configs
      for insert
      to authenticated
      with check (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.role = 'admin'
        )
      )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'admin_configs' and policyname = 'admin_configs_update_admin'
  ) then
    execute $policy$
      create policy admin_configs_update_admin
      on public.admin_configs
      for update
      to authenticated
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.role = 'admin'
        )
      )
      with check (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.role = 'admin'
        )
      )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'admin_configs' and policyname = 'admin_configs_delete_admin'
  ) then
    execute $policy$
      create policy admin_configs_delete_admin
      on public.admin_configs
      for delete
      to authenticated
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.role = 'admin'
        )
      )
    $policy$;
  end if;
end
$$;

-- sales_updates: read own/privileged; write by admin/accountant

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'sales_updates' and policyname = 'sales_updates_select_own_or_privileged'
  ) then
    execute $policy$
      create policy sales_updates_select_own_or_privileged
      on public.sales_updates
      for select
      to authenticated
      using (
        user_id = auth.uid()
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.role in ('admin', 'hr', 'accountant')
        )
      )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'sales_updates' and policyname = 'sales_updates_insert_admin_accountant'
  ) then
    execute $policy$
      create policy sales_updates_insert_admin_accountant
      on public.sales_updates
      for insert
      to authenticated
      with check (
        created_by = auth.uid()
        and exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.role in ('admin', 'accountant')
        )
      )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'sales_updates' and policyname = 'sales_updates_update_admin_accountant'
  ) then
    execute $policy$
      create policy sales_updates_update_admin_accountant
      on public.sales_updates
      for update
      to authenticated
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.role in ('admin', 'accountant')
        )
      )
      with check (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.role in ('admin', 'accountant')
        )
      )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'sales_updates' and policyname = 'sales_updates_delete_admin_accountant'
  ) then
    execute $policy$
      create policy sales_updates_delete_admin_accountant
      on public.sales_updates
      for delete
      to authenticated
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.role in ('admin', 'accountant')
        )
      )
    $policy$;
  end if;
end
$$;

commit;
