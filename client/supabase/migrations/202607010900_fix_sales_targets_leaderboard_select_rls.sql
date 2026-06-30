begin;

drop policy if exists "sales_targets_select_by_role" on public.sales_targets;

-- Gemify uses transparent sales competition.
-- All authenticated users may read sales target rows for employee profiles so
-- the company-wide leaderboard can show employee names, avatars, targets,
-- current sales, achievement percentages, and rank.
-- This policy is SELECT-only. Employee INSERT, UPDATE, and DELETE permissions
-- remain restricted by the existing write policies.
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
    from public.profiles target_profile
    where target_profile.id = sales_targets.user_id
      and target_profile.role = 'employee'
  )
);

commit;
