begin;

alter table public.anonymous_mailbox_messages
add column if not exists sender_id uuid references public.profiles(id) on delete cascade,
add column if not exists recipient_id uuid references public.profiles(id) on delete set null,
add column if not exists is_anonymous boolean not null default true;

update public.anonymous_mailbox_messages
set sender_id = coalesce(sender_id, user_id)
where sender_id is null;

alter table public.anonymous_mailbox_messages
alter column sender_id set not null;

create index if not exists anonymous_mailbox_messages_sender_idx
on public.anonymous_mailbox_messages(sender_id);

create index if not exists anonymous_mailbox_messages_recipient_idx
on public.anonymous_mailbox_messages(recipient_id);

drop policy if exists "anonymous_mailbox_insert_own" on public.anonymous_mailbox_messages;
create policy "anonymous_mailbox_insert_own"
on public.anonymous_mailbox_messages
for insert
to authenticated
with check (
  auth.uid() is not null
  and user_id = auth.uid()
  and sender_id = auth.uid()
  and recipient_id is not null
  and exists (
    select 1
    from public.profiles p
    where p.id = recipient_id
      and p.role in ('admin', 'accountant')
  )
);

drop policy if exists "anonymous_mailbox_select_admin_accountant" on public.anonymous_mailbox_messages;
create policy "anonymous_mailbox_select_admin_accountant"
on public.anonymous_mailbox_messages
for select
to authenticated
using (
  recipient_id = auth.uid()
  or (
    recipient_id is null
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'accountant')
    )
  )
);

drop policy if exists "anonymous_mailbox_update_admin_accountant" on public.anonymous_mailbox_messages;
create policy "anonymous_mailbox_update_admin_accountant"
on public.anonymous_mailbox_messages
for update
to authenticated
using (
  recipient_id = auth.uid()
  or (
    recipient_id is null
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'accountant')
    )
  )
)
with check (
  recipient_id = auth.uid()
  or (
    recipient_id is null
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'accountant')
    )
  )
);

grant insert, select, update on public.anonymous_mailbox_messages to authenticated;

select pg_notify('pgrst', 'reload schema');

commit;
