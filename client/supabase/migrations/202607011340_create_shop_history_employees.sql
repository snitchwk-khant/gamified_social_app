begin;

create table if not exists public.shop_history_employees (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  year integer not null,
  month integer not null check (month between 1 and 12),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint shop_history_employees_unique_employee unique (shop_id, year, month, employee_id),
  constraint shop_history_employees_target_fkey
    foreign key (shop_id, month, year)
    references public.shop_sales_targets(shop_id, month, year)
    on delete cascade
);

create index if not exists shop_history_employees_shop_period_idx
on public.shop_history_employees(shop_id, year, month);

create index if not exists shop_history_employees_employee_id_idx
on public.shop_history_employees(employee_id);

alter table public.shop_history_employees enable row level security;

drop policy if exists "shop_history_employees_select_authenticated" on public.shop_history_employees;
create policy "shop_history_employees_select_authenticated"
on public.shop_history_employees
for select
to authenticated
using (true);

drop policy if exists "shop_history_employees_insert_admin_accountant" on public.shop_history_employees;
create policy "shop_history_employees_insert_admin_accountant"
on public.shop_history_employees
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

drop policy if exists "shop_history_employees_delete_admin_accountant" on public.shop_history_employees;
create policy "shop_history_employees_delete_admin_accountant"
on public.shop_history_employees
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'accountant')
  )
);

commit;
