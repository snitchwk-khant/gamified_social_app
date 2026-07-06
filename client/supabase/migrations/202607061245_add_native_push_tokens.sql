begin;

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('android', 'ios')),
  installation_id text not null,
  app_id text not null default 'com.gemify.app',
  is_active boolean not null default true,
  last_registered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_tokens_token_key unique (token),
  constraint push_tokens_user_installation_key unique (user_id, installation_id)
);

create index if not exists push_tokens_user_id_idx
on public.push_tokens(user_id);

create index if not exists push_tokens_active_idx
on public.push_tokens(is_active);

drop trigger if exists push_tokens_touch_updated_at on public.push_tokens;
create trigger push_tokens_touch_updated_at
before update on public.push_tokens
for each row
execute function public.touch_updated_at();

alter table public.push_tokens enable row level security;

drop policy if exists "push_tokens_select_own_or_admin_accountant" on public.push_tokens;
drop policy if exists "push_tokens_insert_own" on public.push_tokens;
drop policy if exists "push_tokens_update_own" on public.push_tokens;
drop policy if exists "push_tokens_delete_own_or_admin" on public.push_tokens;

create policy "push_tokens_select_own_or_admin_accountant"
on public.push_tokens
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'accountant')
  )
);

create policy "push_tokens_insert_own"
on public.push_tokens
for insert
to authenticated
with check (user_id = auth.uid());

create policy "push_tokens_update_own"
on public.push_tokens
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "push_tokens_delete_own_or_admin"
on public.push_tokens
for delete
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

grant select, insert, update, delete on public.push_tokens to authenticated;

create or replace function public.register_native_push_token(
  push_token text,
  push_platform text,
  push_installation_id text,
  push_app_id text default 'com.gemify.app'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  registered_token_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if nullif(push_token, '') is null then
    raise exception 'push_token is required';
  end if;

  if push_platform not in ('android', 'ios') then
    raise exception 'Unsupported push platform: %', push_platform;
  end if;

  if nullif(push_installation_id, '') is null then
    raise exception 'push_installation_id is required';
  end if;

  update public.push_tokens
  set is_active = false
  where user_id = auth.uid()
    and installation_id = push_installation_id
    and token <> push_token;

  insert into public.push_tokens (
    user_id,
    token,
    platform,
    installation_id,
    app_id,
    is_active,
    last_registered_at
  )
  values (
    auth.uid(),
    push_token,
    push_platform,
    push_installation_id,
    coalesce(nullif(push_app_id, ''), 'com.gemify.app'),
    true,
    now()
  )
  on conflict (token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        installation_id = excluded.installation_id,
        app_id = excluded.app_id,
        is_active = true,
        last_registered_at = now(),
        updated_at = now()
  returning id into registered_token_id;

  return registered_token_id;
end;
$$;

create or replace function public.deactivate_native_push_installation(push_installation_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  update public.push_tokens
  set is_active = false,
      updated_at = now()
  where user_id = auth.uid()
    and installation_id = push_installation_id;
end;
$$;

grant execute on function public.register_native_push_token(text, text, text, text) to authenticated;
grant execute on function public.deactivate_native_push_installation(text) to authenticated;

create table if not exists public.notification_push_queue (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  push_token_id uuid not null references public.push_tokens(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null check (platform in ('android', 'ios')),
  title text not null,
  body text not null,
  action_url text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_push_queue_unique_token_notification unique (notification_id, push_token_id)
);

create index if not exists notification_push_queue_status_idx
on public.notification_push_queue(status, created_at);

create index if not exists notification_push_queue_recipient_idx
on public.notification_push_queue(recipient_id);

drop trigger if exists notification_push_queue_touch_updated_at on public.notification_push_queue;
create trigger notification_push_queue_touch_updated_at
before update on public.notification_push_queue
for each row
execute function public.touch_updated_at();

alter table public.notification_push_queue enable row level security;

drop policy if exists "notification_push_queue_select_admin_accountant" on public.notification_push_queue;
drop policy if exists "notification_push_queue_update_admin_accountant" on public.notification_push_queue;
drop policy if exists "notification_push_queue_delete_admin" on public.notification_push_queue;

create policy "notification_push_queue_select_admin_accountant"
on public.notification_push_queue
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

create policy "notification_push_queue_update_admin_accountant"
on public.notification_push_queue
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

create policy "notification_push_queue_delete_admin"
on public.notification_push_queue
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

grant select, update, delete on public.notification_push_queue to authenticated;

create or replace function public.queue_native_push_for_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_action_url text;
  notification_body text;
begin
  if new.recipient_type <> 'user' or new.recipient_id is null or new.is_published = false then
    return new;
  end if;

  resolved_action_url := coalesce(new.metadata->>'action_url', '/notifications');
  notification_body := coalesce(nullif(new.message, ''), nullif(new.body, ''), new.title);

  insert into public.notification_push_queue (
    notification_id,
    push_token_id,
    recipient_id,
    platform,
    title,
    body,
    action_url,
    payload
  )
  select
    new.id,
    pt.id,
    new.recipient_id,
    pt.platform,
    new.title,
    notification_body,
    resolved_action_url,
    jsonb_build_object(
      'notification_id', new.id,
      'recipient_id', new.recipient_id,
      'type', new.type,
      'category', new.category,
      'action_url', resolved_action_url,
      'metadata', new.metadata
    )
  from public.push_tokens pt
  where pt.user_id = new.recipient_id
    and pt.is_active = true
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists notifications_queue_native_push on public.notifications;
create trigger notifications_queue_native_push
after insert on public.notifications
for each row
execute function public.queue_native_push_for_notification();

select pg_notify('pgrst', 'reload schema');

commit;
