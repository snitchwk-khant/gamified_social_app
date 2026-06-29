begin;

alter table public.stories
add column if not exists story_type text not null default 'image';

alter table public.stories
add column if not exists background_color text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.stories'::regclass
      and conname = 'stories_story_type_check'
  ) then
    alter table public.stories
    add constraint stories_story_type_check
    check (story_type in ('text', 'image', 'video'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.stories'::regclass
      and conname = 'stories_background_color_check'
  ) then
    alter table public.stories
    add constraint stories_background_color_check
    check (
      background_color is null
      or background_color in ('purple', 'pink', 'blue', 'orange', 'green', 'dark')
    );
  end if;
end
$$;

commit;
