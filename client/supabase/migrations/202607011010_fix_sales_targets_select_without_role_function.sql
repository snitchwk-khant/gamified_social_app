begin;

drop policy if exists "sales_targets_select_by_role" on public.sales_targets;

create policy "sales_targets_select_by_role"
on public.sales_targets
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'accountant')
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = sales_targets.user_id
      and p.role = 'employee'
  )
);

commit;
