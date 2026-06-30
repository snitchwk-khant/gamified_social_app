begin;

drop policy if exists "sales_targets_select_by_role" on public.sales_targets;

-- Leaderboard visibility rule:
-- Gemify uses transparent employee sales competition, so authenticated users
-- may read sales target rows that belong to employee profiles.
-- Admin and accountant users retain full read access.
-- This policy is SELECT-only and does not grant employees INSERT, UPDATE, or DELETE.
create policy "sales_targets_select_by_role"
on public.sales_targets
for select
to authenticated
using (
  public.current_user_role() in ('admin', 'accountant')
  or exists (
    select 1
    from public.profiles p
    where p.id = sales_targets.user_id
      and p.role = 'employee'
  )
);

commit;
