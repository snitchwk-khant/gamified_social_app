begin;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'posts'
      and policyname = 'posts_delete_own'
  ) then
    create policy "posts_delete_own"
    on public.posts
    for delete
    to authenticated
    using (user_id = auth.uid());
  end if;
end
$$;

commit;
