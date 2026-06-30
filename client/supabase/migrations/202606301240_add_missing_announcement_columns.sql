begin;

alter table public.announcements
add column if not exists is_active boolean not null default true;

alter table public.announcements
add column if not exists expires_at timestamptz;

commit;
