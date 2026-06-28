begin;

create table if not exists public.profile_albums (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  image_url text not null,
  sort_order integer default 0,
  created_at timestamptz default now()
);

create index if not exists profile_albums_user_id_sort_order_idx
on public.profile_albums (user_id, sort_order, created_at);

alter table public.profile_albums enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profile_albums'
      and policyname = 'profile_albums_select_public'
  ) then
    create policy "profile_albums_select_public"
    on public.profile_albums for select
    to public
    using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profile_albums'
      and policyname = 'profile_albums_insert_own'
  ) then
    create policy "profile_albums_insert_own"
    on public.profile_albums for insert
    to authenticated
    with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profile_albums'
      and policyname = 'profile_albums_delete_own'
  ) then
    create policy "profile_albums_delete_own"
    on public.profile_albums for delete
    to authenticated
    using (user_id = auth.uid());
  end if;
end
$$;

commit;
