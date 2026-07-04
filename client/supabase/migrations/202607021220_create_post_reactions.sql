begin;

create table if not exists public.post_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null default 'love',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint post_reactions_post_user_key unique (post_id, user_id)
);

alter table public.post_reactions
drop constraint if exists post_reactions_user_id_fkey;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'post_reactions_user_id_fkey'
      and conrelid = 'public.post_reactions'::regclass
  ) then
    alter table public.post_reactions
    add constraint post_reactions_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end $$;

alter table public.post_reactions
add column if not exists updated_at timestamptz not null default now();

alter table public.post_reactions
drop constraint if exists post_reactions_reaction_check;

alter table public.post_reactions
alter column reaction set default 'love';

update public.post_reactions
set reaction = 'love'
where reaction is distinct from 'love';

alter table public.post_reactions
add constraint post_reactions_reaction_check check (reaction = 'love');

insert into public.post_reactions (post_id, user_id, reaction, created_at, updated_at)
select likes.post_id, likes.user_id, 'love', likes.created_at, likes.created_at
from public.likes
where likes.post_id is not null
on conflict (post_id, user_id) do nothing;

create index if not exists post_reactions_post_id_idx
on public.post_reactions(post_id);

create index if not exists post_reactions_user_id_idx
on public.post_reactions(user_id);

alter table public.post_reactions replica identity full;

alter table public.post_reactions enable row level security;

drop policy if exists "post_reactions_select_authenticated" on public.post_reactions;
drop policy if exists "post_reactions_insert_own" on public.post_reactions;
drop policy if exists "post_reactions_update_own" on public.post_reactions;
drop policy if exists "post_reactions_delete_own" on public.post_reactions;
drop policy if exists "post_reactions_admin_all" on public.post_reactions;

create policy "post_reactions_select_authenticated"
on public.post_reactions
for select
to authenticated
using (true);

create policy "post_reactions_insert_own"
on public.post_reactions
for insert
to authenticated
with check (
  auth.uid() is not null
  and user_id = auth.uid()
);

create policy "post_reactions_update_own"
on public.post_reactions
for update
to authenticated
using (
  auth.uid() is not null
  and user_id = auth.uid()
)
with check (
  auth.uid() is not null
  and user_id = auth.uid()
);

create policy "post_reactions_delete_own"
on public.post_reactions
for delete
to authenticated
using (
  auth.uid() is not null
  and user_id = auth.uid()
);

create policy "post_reactions_admin_all"
on public.post_reactions
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

grant select, insert, update, delete on public.post_reactions to authenticated;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'post_reactions'
  ) then
    alter publication supabase_realtime add table public.post_reactions;
  end if;
end $$;

commit;
