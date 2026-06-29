begin;

insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'post_images_public_read'
  ) then
    create policy "post_images_public_read"
    on storage.objects for select
    to public
    using (bucket_id = 'post-images');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'post_images_upload_own_folder'
  ) then
    create policy "post_images_upload_own_folder"
    on storage.objects for insert
    to authenticated
    with check (
      bucket_id = 'post-images'
      and split_part(name, '/', 1) = auth.uid()::text
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'post_images_delete_own_folder'
  ) then
    create policy "post_images_delete_own_folder"
    on storage.objects for delete
    to authenticated
    using (
      bucket_id = 'post-images'
      and split_part(name, '/', 1) = auth.uid()::text
    );
  end if;
end
$$;

commit;
