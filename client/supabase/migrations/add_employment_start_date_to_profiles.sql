begin;

alter table public.profiles
add column if not exists employment_start_date date null;

create or replace function public.can_update_profile_employment_start_date(next_profile public.profiles)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  actor_role text;
  existing_profile public.profiles;
begin
  select p.role
  into actor_role
  from public.profiles p
  where p.id = auth.uid();

  actor_role := coalesce(actor_role, 'employee');

  if actor_role = 'admin' then
    return true;
  end if;

  select *
  into existing_profile
  from public.profiles p
  where p.id = next_profile.id;

  if existing_profile.id is null then
    return false;
  end if;

  if actor_role = 'accountant' then
    return (to_jsonb(existing_profile) - 'employment_start_date' - 'updated_at')
      is not distinct from
      (to_jsonb(next_profile) - 'employment_start_date' - 'updated_at');
  end if;

  if next_profile.id = auth.uid() then
    return existing_profile.employment_start_date is not distinct from next_profile.employment_start_date;
  end if;

  return false;
end;
$$;

drop policy if exists "profiles_update_self_or_admin" on public.profiles;
drop policy if exists "profiles_update_self_admin_or_accountant_start_date" on public.profiles;
drop policy if exists "profiles_update_self_admin_accountant_employment_start_date" on public.profiles;

create policy "profiles_update_self_admin_accountant_employment_start_date"
on public.profiles
for update
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'accountant')
  )
)
with check (
  public.can_update_profile_employment_start_date(profiles)
);

commit;
