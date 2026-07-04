begin;

drop policy if exists "notifications_select_own_or_admin" on public.notifications;
drop policy if exists "notifications_select_addressed_or_admin" on public.notifications;
drop policy if exists "notifications_select_addressed_or_admin_accountant" on public.notifications;
drop policy if exists "notifications_select_targets_or_admin_accountant" on public.notifications;

create policy "notifications_select_targets_or_admin_accountant"
on public.notifications
for select
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
  or recipient_type = 'everyone'
  or (
    recipient_type = 'shop'
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.shop_id = notifications.recipient_id
    )
  )
);

grant select on public.notifications to authenticated;

select pg_notify('pgrst', 'reload schema');

commit;
