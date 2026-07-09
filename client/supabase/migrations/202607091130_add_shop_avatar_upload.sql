begin;

alter table public.shops
add column if not exists avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shop-avatars',
  'shop-avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "shop_avatars_select_authenticated" on storage.objects;
create policy "shop_avatars_select_authenticated"
on storage.objects
for select
to authenticated
using (bucket_id = 'shop-avatars');

drop policy if exists "shop_avatars_insert_admin_accountant" on storage.objects;
create policy "shop_avatars_insert_admin_accountant"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'shop-avatars'
  and exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role in ('admin', 'accountant')
  )
);

drop policy if exists "shop_avatars_update_admin_accountant" on storage.objects;
create policy "shop_avatars_update_admin_accountant"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'shop-avatars'
  and exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role in ('admin', 'accountant')
  )
)
with check (
  bucket_id = 'shop-avatars'
  and exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role in ('admin', 'accountant')
  )
);

drop policy if exists "shop_avatars_delete_admin_accountant" on storage.objects;
create policy "shop_avatars_delete_admin_accountant"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'shop-avatars'
  and exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role in ('admin', 'accountant')
  )
);

select pg_notify('pgrst', 'reload schema');

commit;
