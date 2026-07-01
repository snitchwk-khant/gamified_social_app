begin;

-- Shop History Management lets admin and accountant users remove historical
-- monthly shop performance rows from the existing shop_sales_targets table.
-- This does not create a new table and does not weaken insert/update rules.
drop policy if exists "shop_sales_targets_delete_admin" on public.shop_sales_targets;
drop policy if exists "shop_sales_targets_delete_admin_accountant" on public.shop_sales_targets;

create policy "shop_sales_targets_delete_admin_accountant"
on public.shop_sales_targets
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
