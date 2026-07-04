begin;

drop policy if exists "notifications_update_own_or_admin" on public.notifications;
drop policy if exists "notifications_update_addressed_or_admin" on public.notifications;
drop policy if exists "notifications_update_admin_accountant" on public.notifications;
drop policy if exists "notifications_update_addressed_or_admin_accountant" on public.notifications;

create policy "notifications_update_addressed_or_admin_accountant"
on public.notifications
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'accountant')
  )
  or user_id = auth.uid()
  or (
    recipient_type = 'user'
    and recipient_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'accountant')
  )
  or user_id = auth.uid()
  or (
    recipient_type = 'user'
    and recipient_id = auth.uid()
  )
);

grant update on public.notifications to authenticated;

select pg_notify('pgrst', 'reload schema');

commit;
