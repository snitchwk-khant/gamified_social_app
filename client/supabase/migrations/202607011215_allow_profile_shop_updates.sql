begin;

drop policy if exists "profiles_update_employee_shop_admin_accountant" on public.profiles;
create policy "profiles_update_employee_shop_admin_accountant"
on public.profiles
for update
to authenticated
using (
  role = 'employee'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'accountant')
  )
)
with check (
  role = 'employee'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'accountant')
  )
);

commit;
