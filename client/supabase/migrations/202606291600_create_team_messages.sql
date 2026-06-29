begin;

create table if not exists public.team_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now(),
  constraint team_messages_message_length_check
    check (char_length(trim(message)) between 1 and 1000)
);

create index if not exists team_messages_created_at_idx
on public.team_messages(created_at asc);

create index if not exists team_messages_user_id_idx
on public.team_messages(user_id);

alter table public.team_messages enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.team_messages'::regclass
      and conname = 'team_messages_message_length_check'
  ) then
    alter table public.team_messages
    add constraint team_messages_message_length_check
    check (char_length(trim(message)) between 1 and 1000);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'team_messages'
      and policyname = 'team_messages_select_authenticated'
  ) then
    create policy team_messages_select_authenticated
    on public.team_messages for select
    to authenticated
    using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'team_messages'
      and policyname = 'team_messages_insert_own'
  ) then
    create policy team_messages_insert_own
    on public.team_messages for insert
    to authenticated
    with check (user_id = auth.uid());
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'team_messages'
  ) then
    alter publication supabase_realtime add table public.team_messages;
  end if;
end
$$;

commit;
