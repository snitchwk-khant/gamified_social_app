begin;

alter table public.shop_sales_targets
add column if not exists employee_of_month_id uuid references public.profiles(id) on delete set null,
add column if not exists highest_achievement numeric check (highest_achievement is null or highest_achievement >= 0),
add column if not exists champion_count integer not null default 0 check (champion_count >= 0),
add column if not exists notes text;

create index if not exists shop_sales_targets_employee_of_month_idx
on public.shop_sales_targets(employee_of_month_id);

commit;
