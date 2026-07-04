begin;

create table if not exists public.notification_reads (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  constraint notification_reads_notification_user_key unique (notification_id, user_id)
);

insert into public.notification_reads (notification_id, user_id, read_at)
select n.id, n.user_id, coalesce(n.created_at, now())
from public.notifications n
where n.is_read = true
  and n.user_id is not null
on conflict (notification_id, user_id) do nothing;

create index if not exists notification_reads_notification_id_idx
on public.notification_reads(notification_id);

create index if not exists notification_reads_user_id_idx
on public.notification_reads(user_id);

alter table public.notification_reads enable row level security;

drop policy if exists "notification_reads_select_own_or_admin" on public.notification_reads;
drop policy if exists "notification_reads_insert_own" on public.notification_reads;
drop policy if exists "notification_reads_admin_all" on public.notification_reads;

create policy "notification_reads_select_own_or_admin"
on public.notification_reads
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

create policy "notification_reads_insert_own"
on public.notification_reads
for insert
to authenticated
with check (user_id = auth.uid());

create policy "notification_reads_admin_all"
on public.notification_reads
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

grant select, insert, update, delete on public.notification_reads to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notification_reads'
  ) then
    alter publication supabase_realtime add table public.notification_reads;
  end if;
end $$;

select pg_notify('pgrst', 'reload schema');

commit;
