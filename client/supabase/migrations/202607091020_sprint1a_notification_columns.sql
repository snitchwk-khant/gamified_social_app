begin;

alter table public.notifications
add column if not exists actor_id uuid references public.profiles(id) on delete set null,
add column if not exists entity_type text,
add column if not exists entity_id uuid;

do $$
declare
  created_column_count integer;
begin
  select count(*)
  into created_column_count
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'notifications'
    and column_name in ('actor_id', 'entity_type', 'entity_id');

  if created_column_count <> 3 then
    raise exception 'Sprint 1A failed: expected actor_id, entity_type, entity_id on public.notifications, found % column(s)', created_column_count;
  end if;
end $$;

create index if not exists notifications_actor_id_idx
on public.notifications(actor_id);

create index if not exists notifications_entity_idx
on public.notifications(entity_type, entity_id);

select pg_notify('pgrst', 'reload schema');

commit;
