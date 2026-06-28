begin;

alter table public.profiles add column if not exists hobby text;
alter table public.profiles add column if not exists relationship_status text;
alter table public.profiles add column if not exists zodiac_sign text;
alter table public.profiles add column if not exists telegram_username text;
alter table public.profiles add column if not exists favorite_music text;

commit;
