begin;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'story_views'
      and policyname = 'story_views_select_own_view'
  ) then
    create policy "story_views_select_own_view"
    on public.story_views
    for select
    to authenticated
    using (viewer_user_id = auth.uid());
  end if;
end
$$;

commit;
