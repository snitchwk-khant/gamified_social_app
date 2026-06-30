begin;

drop policy if exists "announcements_write_admin_hr" on public.announcements;
drop policy if exists announcements_insert_hr_admin on public.announcements;
drop policy if exists announcements_update_hr_admin on public.announcements;
drop policy if exists announcements_delete_hr_admin on public.announcements;
drop policy if exists "announcements_insert_admin_accountant" on public.announcements;
drop policy if exists "announcements_update_admin_accountant" on public.announcements;
drop policy if exists "announcements_delete_admin" on public.announcements;

create policy "announcements_insert_admin_accountant"
on public.announcements
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'accountant')
  )
);

create policy "announcements_update_admin_accountant"
on public.announcements
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

commit;
