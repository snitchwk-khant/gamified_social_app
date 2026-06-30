begin;

create or replace function public.assign_shop_employees(
  employee_ids uuid[],
  target_shop_id uuid
)
returns setof public.profiles
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'accountant')
  ) then
    raise exception 'Only admins and accountants can assign shop employees.';
  end if;

  if target_shop_id is null then
    raise exception 'Shop id is required.';
  end if;

  if not exists (
    select 1
    from public.shops s
    where s.id = target_shop_id
  ) then
    raise exception 'Shop not found.';
  end if;

  update public.profiles p
  set shop_id = target_shop_id
  where p.id = any(coalesce(employee_ids, '{}'))
    and p.role = 'employee';

  return query
  select p.*
  from public.profiles p
  where p.id = any(coalesce(employee_ids, '{}'))
    and p.role = 'employee'
  order by p.full_name nulls last, p.email;
end;
$$;

revoke execute on function public.assign_shop_employees(uuid[], uuid) from public;
grant execute on function public.assign_shop_employees(uuid[], uuid) to authenticated;

commit;
