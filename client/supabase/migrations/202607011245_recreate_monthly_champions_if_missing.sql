begin;

create table if not exists public.monthly_champions (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  total_points integer not null default 0 check (total_points >= 0),
  rank integer not null default 1 check (rank = 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.monthly_champions
add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'monthly_champions_month_key'
      and conrelid = 'public.monthly_champions'::regclass
  ) then
    alter table public.monthly_champions
      add constraint monthly_champions_month_key unique (month);
  end if;
end $$;

create index if not exists monthly_champions_user_id_idx on public.monthly_champions(user_id);
create index if not exists monthly_champions_month_idx on public.monthly_champions(month desc);

alter table public.monthly_champions enable row level security;

drop policy if exists "monthly_champions_select_authenticated" on public.monthly_champions;
create policy "monthly_champions_select_authenticated"
on public.monthly_champions
for select
to authenticated
using (true);

create or replace function public.refresh_monthly_champion(champion_month date default date_trunc('month', now())::date)
returns public.monthly_champions
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_month date := date_trunc('month', champion_month)::date;
  champion_row public.monthly_champions;
begin
  with candidates as (
    select
      st.user_id,
      st.current_sales::integer as total_points,
      st.updated_at,
      coalesce(streaks.streak_count, 0) as streak_count
    from public.sales_targets st
    join public.profiles p on p.id = st.user_id
    left join lateral (
      with periods as (
        select generate_series(
          normalized_month - interval '23 months',
          normalized_month,
          interval '1 month'
        )::date as month_date
      ),
      scored_periods as (
        select
          periods.month_date,
          coalesce(history.current_sales >= history.target_sales and history.target_sales > 0, false) as qualified
        from periods
        left join public.sales_targets history
          on history.user_id = st.user_id
         and make_date(history.year, history.month, 1) = periods.month_date
      ),
      last_break as (
        select coalesce(max(month_date), (normalized_month - interval '24 months')::date) as month_date
        from scored_periods
        where month_date <= normalized_month
          and not qualified
      )
      select count(*)::integer as streak_count
      from scored_periods, last_break
      where scored_periods.month_date > last_break.month_date
        and scored_periods.month_date <= normalized_month
        and scored_periods.qualified
    ) streaks on true
    where make_date(st.year, st.month, 1) = normalized_month
      and p.role = 'employee'
  ),
  winner as (
    select *
    from candidates
    order by total_points desc, streak_count desc, updated_at asc
    limit 1
  )
  insert into public.monthly_champions (month, user_id, total_points, rank)
  select normalized_month, user_id, total_points, 1
  from winner
  on conflict (month) do update
    set user_id = excluded.user_id,
        total_points = excluded.total_points,
        rank = excluded.rank,
        updated_at = now()
  returning * into champion_row;

  return champion_row;
end;
$$;

create or replace function public.refresh_monthly_champion_from_sales_target()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_monthly_champion(make_date(new.year, new.month, 1));
  return new;
end;
$$;

drop trigger if exists sales_targets_refresh_monthly_champion on public.sales_targets;
drop trigger if exists sales_targets_refresh_monthly_champion_insert on public.sales_targets;
drop trigger if exists sales_targets_refresh_monthly_champion_update on public.sales_targets;

create trigger sales_targets_refresh_monthly_champion_insert
after insert on public.sales_targets
for each row
execute function public.refresh_monthly_champion_from_sales_target();

create trigger sales_targets_refresh_monthly_champion_update
after update of current_sales, target_sales on public.sales_targets
for each row
when (
  old.current_sales is distinct from new.current_sales
  or old.target_sales is distinct from new.target_sales
)
execute function public.refresh_monthly_champion_from_sales_target();

revoke execute on function public.refresh_monthly_champion(date) from public;
revoke execute on function public.refresh_monthly_champion(date) from authenticated;
grant execute on function public.refresh_monthly_champion(date) to service_role;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  )
  and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'monthly_champions'
  ) then
    alter publication supabase_realtime add table public.monthly_champions;
  end if;
end $$;

commit;
