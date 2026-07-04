begin;

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own_or_admin" on public.notifications;
drop policy if exists "notifications_select_addressed_or_admin" on public.notifications;
drop policy if exists "notifications_select_addressed_or_admin_accountant" on public.notifications;
drop policy if exists "notifications_insert_admin_or_hr" on public.notifications;
drop policy if exists "notifications_insert_admin" on public.notifications;
drop policy if exists "notifications_insert_admin_accountant" on public.notifications;
drop policy if exists "notifications_update_own_or_admin" on public.notifications;
drop policy if exists "notifications_update_addressed_or_admin" on public.notifications;
drop policy if exists "notifications_update_admin_accountant" on public.notifications;
drop policy if exists "notifications_delete_admin" on public.notifications;
drop policy if exists "notifications_delete_admin_accountant" on public.notifications;

create policy "notifications_select_addressed_or_admin_accountant"
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
);

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

create policy "notifications_update_admin_accountant"
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
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'accountant')
  )
);

create policy "notifications_delete_admin_accountant"
on public.notifications
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

grant select, insert, update, delete on public.notifications to authenticated;

select pg_notify('pgrst', 'reload schema');

commit;
