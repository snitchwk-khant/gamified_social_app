begin;

-- Create the mailbox table if the earlier mailbox migration was not applied.
-- user_id is kept for RLS ownership checks, but frontend/admin reads do not select it,
-- so the sender remains masked in the UI.
create table if not exists public.anonymous_mailbox_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  category text,
  subject text,
  message text,
  status text not null default 'unread',
  reviewed boolean not null default false
);

-- Patch partially-created tables from older local migrations without recreating data.
alter table public.anonymous_mailbox_messages
add column if not exists user_id uuid references public.profiles(id) on delete cascade,
add column if not exists created_at timestamptz not null default now(),
add column if not exists category text,
add column if not exists subject text,
add column if not exists message text,
add column if not exists status text not null default 'unread',
add column if not exists reviewed boolean not null default false;

create index if not exists anonymous_mailbox_messages_created_at_idx
on public.anonymous_mailbox_messages(created_at desc);

create index if not exists anonymous_mailbox_messages_status_idx
on public.anonymous_mailbox_messages(status);

alter table public.anonymous_mailbox_messages enable row level security;

-- Employees can submit anonymous messages, but only for their own auth user.
drop policy if exists "anonymous_mailbox_insert_own" on public.anonymous_mailbox_messages;
create policy "anonymous_mailbox_insert_own"
on public.anonymous_mailbox_messages
for insert
to authenticated
with check (
  auth.uid() is not null
  and user_id = auth.uid()
);

-- Only admin/accountant users can read mailbox messages.
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

-- Only admin/accountant users can update review/status fields.
drop policy if exists "anonymous_mailbox_update_admin_accountant" on public.anonymous_mailbox_messages;
create policy "anonymous_mailbox_update_admin_accountant"
on public.anonymous_mailbox_messages
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'accountant')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'accountant')
  )
);

-- Table privileges are still protected by RLS policies above.
grant insert, select, update on public.anonymous_mailbox_messages to authenticated;

-- Ask PostgREST to refresh its schema cache after the table/policies are created.
select pg_notify('pgrst', 'reload schema');

commit;
