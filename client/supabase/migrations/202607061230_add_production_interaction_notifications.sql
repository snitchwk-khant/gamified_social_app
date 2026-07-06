begin;

alter table public.notifications
add column if not exists shop_id uuid references public.shops(id) on delete cascade,
add column if not exists message_id uuid references public.messages(id) on delete cascade,
add column if not exists rank integer,
add column if not exists month integer,
add column if not exists year integer;

create index if not exists notifications_shop_id_idx
on public.notifications(shop_id);

create index if not exists notifications_message_id_idx
on public.notifications(message_id);

create index if not exists notifications_period_idx
on public.notifications(year, month);

create unique index if not exists notifications_unique_shop_rank_increased_idx
on public.notifications(type, recipient_id, shop_id, year, month, rank)
where type = 'shop_rank_increased';

create unique index if not exists notifications_unique_monthly_target_completed_idx
on public.notifications(type, recipient_id, shop_id, year, month)
where type = 'monthly_target_completed';

create unique index if not exists notifications_unique_direct_message_idx
on public.notifications(type, recipient_id, message_id)
where type = 'direct_message';

create or replace function public.get_shop_target_rank(
  target_shop_id uuid,
  target_month integer,
  target_year integer,
  override_shop_id uuid default null,
  override_target_sales numeric default null,
  override_current_sales numeric default null,
  override_updated_at timestamptz default null
)
returns integer
language sql
stable
set search_path = public
as $$
  with ranked_targets as (
    select
      normalized_targets.shop_id,
      (row_number() over (
        order by
          normalized_targets.achievement_percent desc,
          normalized_targets.current_sales desc,
          normalized_targets.updated_at asc,
          normalized_targets.shop_name asc
      ))::integer as rank
    from (
      select
        sst.shop_id,
        s.name as shop_name,
        case
          when (
            case
              when sst.shop_id = override_shop_id then coalesce(override_target_sales, sst.target_sales)
              else sst.target_sales
            end
          ) <= 0 then 0
          else round(
            (
              case
                when sst.shop_id = override_shop_id then coalesce(override_current_sales, sst.current_sales)
                else sst.current_sales
              end
              /
              case
                when sst.shop_id = override_shop_id then coalesce(override_target_sales, sst.target_sales)
                else sst.target_sales
              end
            ) * 100,
            2
          )
        end as achievement_percent,
        case
          when sst.shop_id = override_shop_id then coalesce(override_current_sales, sst.current_sales)
          else sst.current_sales
        end as current_sales,
        case
          when sst.shop_id = override_shop_id then coalesce(override_updated_at, sst.updated_at)
          else sst.updated_at
        end as updated_at
      from public.shop_sales_targets sst
      join public.shops s on s.id = sst.shop_id
      where sst.month = target_month
        and sst.year = target_year
        and s.is_active = true
    ) normalized_targets
  )
  select rank
  from ranked_targets
  where shop_id = target_shop_id
  limit 1;
$$;

create or replace function public.insert_shop_notification_for_employees(
  target_shop_id uuid,
  notification_type text,
  notification_title text,
  notification_action_url text,
  target_month integer,
  target_year integer,
  target_rank integer default null,
  actor_profile_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  employee_record record;
begin
  if target_shop_id is null then
    return;
  end if;

  for employee_record in
    select p.id
    from public.profiles p
    where p.shop_id = target_shop_id
      and p.is_active = true
  loop
    insert into public.notifications (
      user_id,
      recipient_type,
      recipient_id,
      actor_id,
      shop_id,
      rank,
      month,
      year,
      title,
      body,
      message,
      type,
      category,
      priority,
      created_by,
      is_published,
      published_at,
      is_read,
      metadata
    )
    values (
      employee_record.id,
      'user',
      employee_record.id,
      actor_profile_id,
      target_shop_id,
      target_rank,
      target_month,
      target_year,
      notification_title,
      notification_title,
      notification_title,
      notification_type,
      case
        when notification_type = 'shop_rank_increased' then 'Leaderboard'
        else 'Achievement'
      end,
      'high',
      actor_profile_id,
      true,
      now(),
      false,
      jsonb_build_object(
        'action_url', notification_action_url,
        'shop_id', target_shop_id,
        'rank', target_rank,
        'month', target_month,
        'year', target_year,
        'type', notification_type
      )
    )
    on conflict do nothing;
  end loop;
end;
$$;

create or replace function public.notify_shop_sales_target_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_rank integer;
  new_rank integer;
  old_achievement numeric := 0;
  new_achievement numeric := 0;
begin
  new_achievement := coalesce(new.achievement_percent, 0);

  if tg_op = 'UPDATE' then
    old_achievement := coalesce(old.achievement_percent, 0);
  end if;

  if new_achievement >= 100 and (tg_op = 'INSERT' or old_achievement < 100) then
    perform public.insert_shop_notification_for_employees(
      new.shop_id,
      'monthly_target_completed',
      '🎯 Monthly target completed.',
      '/monthly-champions',
      new.month,
      new.year,
      null,
      new.updated_by
    );
  end if;

  if tg_op = 'UPDATE' then
    old_rank := public.get_shop_target_rank(
      new.shop_id,
      new.month,
      new.year,
      new.shop_id,
      old.target_sales,
      old.current_sales,
      old.updated_at
    );

    new_rank := public.get_shop_target_rank(new.shop_id, new.month, new.year);

    if old_rank is not null and new_rank is not null and new_rank < old_rank then
      perform public.insert_shop_notification_for_employees(
        new.shop_id,
        'shop_rank_increased',
        '🏆 Your shop moved up to #' || new_rank::text || '.',
        '/leaderboard',
        new.month,
        new.year,
        new_rank,
        new.updated_by
      );
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.notify_direct_message_received()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_name text;
  notification_title text;
  notification_action_url text;
begin
  if new.sender_id is null or new.receiver_id is null or new.sender_id = new.receiver_id then
    return new;
  end if;

  select coalesce(nullif(p.full_name, ''), split_part(p.email, '@', 1), 'Someone')
  into sender_name
  from public.profiles p
  where p.id = new.sender_id;

  sender_name := coalesce(nullif(sender_name, ''), 'Someone');
  notification_title := '📩 ' || sender_name || ' sent you a message.';
  notification_action_url := '/anonymous-mailbox?conversation=' || new.sender_id::text;

  insert into public.notifications (
    user_id,
    recipient_type,
    recipient_id,
    actor_id,
    message_id,
    title,
    body,
    message,
    type,
    category,
    priority,
    created_by,
    is_published,
    published_at,
    is_read,
    metadata
  )
  values (
    new.receiver_id,
    'user',
    new.receiver_id,
    new.sender_id,
    new.id,
    notification_title,
    notification_title,
    notification_title,
    'direct_message',
    'Social',
    'normal',
    new.sender_id,
    true,
    now(),
    false,
    jsonb_build_object(
      'action_url', notification_action_url,
      'message_id', new.id,
      'sender_id', new.sender_id,
      'conversation_id', new.sender_id,
      'type', 'direct_message'
    )
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists shop_sales_targets_notify_events on public.shop_sales_targets;
create trigger shop_sales_targets_notify_events
after insert or update of current_sales, target_sales on public.shop_sales_targets
for each row
execute function public.notify_shop_sales_target_events();

drop trigger if exists messages_notify_direct_message_received on public.messages;
create trigger messages_notify_direct_message_received
after insert on public.messages
for each row
execute function public.notify_direct_message_received();

grant execute on function public.get_shop_target_rank(uuid, integer, integer, uuid, numeric, numeric, timestamptz) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

select pg_notify('pgrst', 'reload schema');

commit;
