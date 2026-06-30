begin;

-- Keep this migration re-runnable while ensuring the function signature matches the frontend RPC call.
drop function if exists public.delete_shop_permanently(uuid);

create or replace function public.delete_shop_permanently(target_shop_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only admins and accountants are allowed to permanently delete shops.
  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'accountant')
  ) then
    raise exception 'Only admins and accountants can delete shops.';
  end if;

  -- Require a shop id so the delete operation cannot run broadly by accident.
  if target_shop_id is null then
    raise exception 'Shop id is required.';
  end if;

  -- Verify the target shop exists before modifying related data.
  if not exists (
    select 1
    from public.shops s
    where s.id = target_shop_id
  ) then
    raise exception 'Shop not found.';
  end if;

  -- Unassign employees and any other profiles currently linked to this shop.
  update public.profiles
  set shop_id = null
  where shop_id = target_shop_id;

  -- Remove shop sales targets before deleting the shop.
  delete from public.shop_sales_targets
  where shop_id = target_shop_id;

  -- Remove shop champion history before deleting the shop.
  delete from public.shop_monthly_champions
  where shop_id = target_shop_id;

  -- Permanently delete the shop record.
  delete from public.shops
  where id = target_shop_id;

  -- Return a simple success value for the frontend RPC call.
  return true;
end;
$$;

-- Do not expose this destructive RPC to anonymous/public callers.
revoke execute on function public.delete_shop_permanently(uuid) from public;

-- Authenticated callers may execute the function, but the function enforces admin/accountant role checks.
grant execute on function public.delete_shop_permanently(uuid) to authenticated;

commit;
