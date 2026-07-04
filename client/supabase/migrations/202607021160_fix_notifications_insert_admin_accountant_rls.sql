begin;

drop policy if exists "notifications_insert_admin_or_hr" on public.notifications;
drop policy if exists "notifications_insert_admin" on public.notifications;
drop policy if exists "notifications_insert_admin_accountant" on public.notifications;

create policy "notifications_insert_admin_accountant"
on public.notifications
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

grant insert on public.notifications to authenticated;

select pg_notify('pgrst', 'reload schema');

commit;
