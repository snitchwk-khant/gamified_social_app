begin;

drop policy if exists "notifications_insert_post_reaction_trigger" on public.notifications;

create policy "notifications_insert_post_reaction_trigger"
on public.notifications
for insert
to public
with check (
  type = 'post_reaction'
  and category = 'Social'
  and priority = 'normal'
  and recipient_type = 'user'
  and recipient_id is not null
  and user_id = recipient_id
  and actor_id = auth.uid()
  and actor_id is not null
  and entity_type = 'post'
  and entity_id is not null
  and is_read = false
  and recipient_id <> actor_id
  and exists (
    select 1
    from public.post_reactions pr
    where pr.post_id = notifications.entity_id
      and pr.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.posts p
    where p.id = notifications.entity_id
      and p.user_id = notifications.recipient_id
      and p.user_id <> auth.uid()
  )
);

select pg_notify('pgrst', 'reload schema');

commit;
