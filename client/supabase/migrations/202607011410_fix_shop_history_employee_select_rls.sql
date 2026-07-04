begin;

-- Restrict historical shop employee visibility:
-- admins/accountants can review all shop history,
-- employees can read only history for their currently assigned shop.
drop policy if exists "shop_history_employees_select_authenticated" on public.shop_history_employees;
drop policy if exists "shop_history_employees_select_by_role_or_shop" on public.shop_history_employees;

create policy "shop_history_employees_select_by_role_or_shop"
on public.shop_history_employees
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        p.role in ('admin', 'accountant')
        or p.shop_id = shop_history_employees.shop_id
      )
  )
);

commit;
