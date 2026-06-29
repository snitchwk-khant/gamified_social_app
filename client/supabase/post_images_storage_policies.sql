begin;

drop policy if exists "post_images_public_read" on storage.objects;
drop policy if exists "post_images_upload_own_folder" on storage.objects;
drop policy if exists "post_images_delete_own_folder" on storage.objects;

create policy "post_images_public_read"
on storage.objects for select
to public
using (bucket_id = 'post-images');

create policy "post_images_upload_own_folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'post-images'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy "post_images_delete_own_folder"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'post-images'
  and split_part(name, '/', 1) = auth.uid()::text
);

commit;
