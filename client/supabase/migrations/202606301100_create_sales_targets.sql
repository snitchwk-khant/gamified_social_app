begin;

create table if not exists public.sales_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  month integer not null check (month between 1 and 12),
  year integer not null,
  target_sales integer not null default 0 check (target_sales >= 0),
  current_sales integer not null default 0 check (current_sales >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sales_targets_user_month_year_key'
      and conrelid = 'public.sales_targets'::regclass
  ) then
    alter table public.sales_targets
      add constraint sales_targets_user_month_year_key unique (user_id, month, year);
  end if;
end $$;

create index if not exists sales_targets_user_id_idx on public.sales_targets(user_id);
create index if not exists sales_targets_period_idx on public.sales_targets(year, month);

drop trigger if exists sales_targets_touch_updated_at on public.sales_targets;
create trigger sales_targets_touch_updated_at
before update on public.sales_targets
for each row
execute function public.touch_updated_at();

alter table public.sales_targets enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sales_targets'
      and policyname = 'sales_targets_select_by_role'
  ) then
    create policy "sales_targets_select_by_role"
    on public.sales_targets
    for select
    to authenticated
    using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sales_targets'
      and policyname = 'sales_targets_insert_admin_accountant'
  ) then
    create policy "sales_targets_insert_admin_accountant"
    on public.sales_targets
    for insert
    to authenticated
    with check (
      exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.role in ('admin', 'accountant')
      )
      and (created_by is null or created_by = auth.uid())
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sales_targets'
      and policyname = 'sales_targets_update_admin_accountant'
  ) then
    create policy "sales_targets_update_admin_accountant"
    on public.sales_targets
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
    );
  end if;
end $$;

drop policy if exists "sales_targets_delete_admin" on public.sales_targets;

commit;
