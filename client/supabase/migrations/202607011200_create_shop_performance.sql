begin;

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name text not null,
  location text,
  manager_id uuid references public.profiles(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
add column if not exists shop_id uuid references public.shops(id) on delete set null;

create table if not exists public.shop_sales_targets (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  year integer not null,
  month integer not null check (month between 1 and 12),
  target_sales numeric not null default 0 check (target_sales >= 0),
  current_sales numeric not null default 0 check (current_sales >= 0),
  achievement_percent numeric generated always as (
    case
      when target_sales <= 0 then 0
      else round((current_sales / target_sales) * 100, 2)
    end
  ) stored,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shop_sales_targets_shop_month_year_key unique (shop_id, month, year)
);

create table if not exists public.shop_monthly_champions (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  shop_id uuid not null references public.shops(id) on delete cascade,
  total_points numeric not null default 0 check (total_points >= 0),
  rank integer not null default 1 check (rank = 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shop_monthly_champions_month_key unique (month)
);

create index if not exists profiles_shop_id_idx on public.profiles(shop_id);
create index if not exists shops_manager_id_idx on public.shops(manager_id);
create index if not exists shops_active_idx on public.shops(is_active);
create index if not exists shop_sales_targets_shop_id_idx on public.shop_sales_targets(shop_id);
create index if not exists shop_sales_targets_period_idx on public.shop_sales_targets(year, month);
create index if not exists shop_monthly_champions_shop_id_idx on public.shop_monthly_champions(shop_id);
create index if not exists shop_monthly_champions_month_idx on public.shop_monthly_champions(month desc);

drop trigger if exists shops_touch_updated_at on public.shops;
create trigger shops_touch_updated_at
before update on public.shops
for each row
execute function public.touch_updated_at();

drop trigger if exists shop_sales_targets_touch_updated_at on public.shop_sales_targets;
create trigger shop_sales_targets_touch_updated_at
before update on public.shop_sales_targets
for each row
execute function public.touch_updated_at();

alter table public.shops enable row level security;
alter table public.shop_sales_targets enable row level security;
alter table public.shop_monthly_champions enable row level security;

drop policy if exists "shops_select_authenticated" on public.shops;
create policy "shops_select_authenticated"
on public.shops
for select
to authenticated
using (true);

drop policy if exists "shops_insert_admin_accountant" on public.shops;
create policy "shops_insert_admin_accountant"
on public.shops
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'accountant')
  )
);

drop policy if exists "shops_update_admin_accountant" on public.shops;
create policy "shops_update_admin_accountant"
on public.shops
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'accountant')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'accountant')
  )
);

drop policy if exists "shops_delete_admin" on public.shops;
create policy "shops_delete_admin"
on public.shops
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

drop policy if exists "shop_sales_targets_select_authenticated" on public.shop_sales_targets;
create policy "shop_sales_targets_select_authenticated"
on public.shop_sales_targets
for select
to authenticated
using (true);

drop policy if exists "shop_sales_targets_insert_admin_accountant" on public.shop_sales_targets;
create policy "shop_sales_targets_insert_admin_accountant"
on public.shop_sales_targets
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'accountant')
  )
  and (updated_by is null or updated_by = auth.uid())
);

drop policy if exists "shop_sales_targets_update_admin_accountant" on public.shop_sales_targets;
create policy "shop_sales_targets_update_admin_accountant"
on public.shop_sales_targets
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'accountant')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'accountant')
  )
  and (updated_by is null or updated_by = auth.uid())
);

drop policy if exists "shop_sales_targets_delete_admin" on public.shop_sales_targets;
create policy "shop_sales_targets_delete_admin"
on public.shop_sales_targets
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

drop policy if exists "shop_monthly_champions_select_authenticated" on public.shop_monthly_champions;
create policy "shop_monthly_champions_select_authenticated"
on public.shop_monthly_champions
for select
to authenticated
using (true);

create or replace function public.refresh_shop_monthly_champion(champion_month date default date_trunc('month', now())::date)
returns public.shop_monthly_champions
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_month date := date_trunc('month', champion_month)::date;
  champion_row public.shop_monthly_champions;
begin
  with winner as (
    select
      sst.shop_id,
      sst.current_sales as total_points,
      sst.achievement_percent,
      sst.updated_at
    from public.shop_sales_targets sst
    join public.shops s on s.id = sst.shop_id
    where make_date(sst.year, sst.month, 1) = normalized_month
      and s.is_active = true
    order by sst.achievement_percent desc, sst.current_sales desc, sst.updated_at asc
    limit 1
  )
  insert into public.shop_monthly_champions (month, shop_id, total_points, rank)
  select normalized_month, shop_id, total_points, 1
  from winner
  on conflict (month) do update
    set shop_id = excluded.shop_id,
        total_points = excluded.total_points,
        rank = excluded.rank,
        updated_at = now()
  returning * into champion_row;

  return champion_row;
end;
$$;

create or replace function public.refresh_shop_monthly_champion_from_target()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_shop_monthly_champion(make_date(new.year, new.month, 1));
  return new;
end;
$$;

drop trigger if exists shop_sales_targets_refresh_shop_monthly_champion_insert on public.shop_sales_targets;
drop trigger if exists shop_sales_targets_refresh_shop_monthly_champion_update on public.shop_sales_targets;

create trigger shop_sales_targets_refresh_shop_monthly_champion_insert
after insert on public.shop_sales_targets
for each row
execute function public.refresh_shop_monthly_champion_from_target();

create trigger shop_sales_targets_refresh_shop_monthly_champion_update
after update of current_sales, target_sales on public.shop_sales_targets
for each row
when (
  old.current_sales is distinct from new.current_sales
  or old.target_sales is distinct from new.target_sales
)
execute function public.refresh_shop_monthly_champion_from_target();

revoke execute on function public.refresh_shop_monthly_champion(date) from public;
revoke execute on function public.refresh_shop_monthly_champion(date) from authenticated;
grant execute on function public.refresh_shop_monthly_champion(date) to service_role;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'shop_sales_targets'
  ) then
    alter publication supabase_realtime add table public.shop_sales_targets;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'shop_monthly_champions'
  ) then
    alter publication supabase_realtime add table public.shop_monthly_champions;
  end if;
end $$;

commit;
