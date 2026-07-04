begin;

create table if not exists public.anonymous_mailbox_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null,
  subject text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists anonymous_mailbox_messages_created_at_idx
on public.anonymous_mailbox_messages(created_at desc);

alter table public.anonymous_mailbox_messages enable row level security;

drop policy if exists "anonymous_mailbox_insert_own" on public.anonymous_mailbox_messages;
create policy "anonymous_mailbox_insert_own"
on public.anonymous_mailbox_messages
for insert
to authenticated
with check (
  auth.uid() is not null
  and user_id = auth.uid()
);

drop policy if exists "anonymous_mailbox_select_admin_accountant" on public.anonymous_mailbox_messages;
create policy "anonymous_mailbox_select_admin_accountant"
on public.anonymous_mailbox_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'accountant')
  )
);

commit;
