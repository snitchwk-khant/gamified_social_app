begin;

create table if not exists public.leaderboard_settings (
  id bigint primary key generated always as identity,
  selected_month integer not null check (selected_month between 1 and 12),
  selected_year integer not null check (selected_year >= 2000),
  updated_at timestamptz not null default now(),
  constraint leaderboard_settings_singleton check (id = 1)
);

insert into public.leaderboard_settings (id, selected_month, selected_year)
overriding system value
select
  1,
  extract(month from now())::integer,
  extract(year from now())::integer
where not exists (
  select 1
  from public.leaderboard_settings
);

alter table public.leaderboard_settings enable row level security;

drop policy if exists "leaderboard_settings_select_authenticated" on public.leaderboard_settings;
create policy "leaderboard_settings_select_authenticated"
on public.leaderboard_settings
for select
to authenticated
using (true);

drop policy if exists "leaderboard_settings_update_admin_accountant" on public.leaderboard_settings;
create policy "leaderboard_settings_update_admin_accountant"
on public.leaderboard_settings
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin','accountant')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin','accountant')
  )
);

commit;
