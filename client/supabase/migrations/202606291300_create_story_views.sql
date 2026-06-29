begin;

create table if not exists public.story_views (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  viewer_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint story_views_story_viewer_unique unique (story_id, viewer_user_id)
);

create index if not exists story_views_story_id_idx on public.story_views(story_id);
create index if not exists story_views_viewer_user_id_idx on public.story_views(viewer_user_id);

alter table public.story_views enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'story_views'
      and policyname = 'story_views_select_story_owner'
  ) then
    create policy "story_views_select_story_owner"
    on public.story_views
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.stories
        where stories.id = story_views.story_id
          and stories.user_id = auth.uid()
      )
    );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'story_views'
      and policyname = 'story_views_select_own_view'
  ) then
    create policy "story_views_select_own_view"
    on public.story_views
    for select
    to authenticated
    using (viewer_user_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'story_views'
      and policyname = 'story_views_insert_self'
  ) then
    create policy "story_views_insert_self"
    on public.story_views
    for insert
    to authenticated
    with check (viewer_user_id = auth.uid());
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
      and tablename = 'story_views'
  ) then
    alter publication supabase_realtime add table public.story_views;
  end if;
end
$$;

commit;
