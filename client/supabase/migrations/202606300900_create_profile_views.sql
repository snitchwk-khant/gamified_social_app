begin;

create extension if not exists pgcrypto;

create table if not exists public.profile_views (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now()
);

create index if not exists profile_views_profile_id_idx
  on public.profile_views(profile_id);

create index if not exists profile_views_viewer_profile_viewed_at_idx
  on public.profile_views(viewer_id, profile_id, viewed_at desc);

create or replace function public.enforce_profile_view_insert_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or new.viewer_id <> auth.uid() then
    return null;
  end if;

  if new.profile_id = new.viewer_id then
    return null;
  end if;

  new.viewed_at = now();

  perform pg_advisory_xact_lock(hashtext(new.profile_id::text), hashtext(new.viewer_id::text));

  if exists (
    select 1
    from public.profile_views
    where profile_id = new.profile_id
      and viewer_id = new.viewer_id
      and viewed_at >= now() - interval '24 hours'
  ) then
    return null;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_profile_view_insert_rules on public.profile_views;

create trigger enforce_profile_view_insert_rules
before insert on public.profile_views
for each row execute function public.enforce_profile_view_insert_rules();

alter table public.profile_views enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profile_views'
      and policyname = 'profile_views_select_public'
  ) then
    create policy "profile_views_select_public"
    on public.profile_views
    for select
    to anon, authenticated
    using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profile_views'
      and policyname = 'profile_views_insert_own'
  ) then
    create policy "profile_views_insert_own"
    on public.profile_views
    for insert
    to authenticated
    with check (
      viewer_id = auth.uid()
      and profile_id <> auth.uid()
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profile_views'
  ) then
    alter publication supabase_realtime add table public.profile_views;
  end if;
end
$$;

commit;
