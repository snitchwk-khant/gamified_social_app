begin;

drop policy if exists "likes_insert_own" on public.likes;

create policy "likes_insert_own"
on public.likes
for insert
to authenticated
with check (
  auth.uid() is not null
  and user_id = auth.uid()
);

commit;
