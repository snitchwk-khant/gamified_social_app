begin;

alter table public.stories
add column if not exists media_url text;

alter table public.stories
alter column media_url drop not null;

alter table public.stories
add column if not exists media_type text not null default 'image';

alter table public.stories
add column if not exists caption text;

alter table public.stories
add column if not exists story_type text not null default 'image';

alter table public.stories
add column if not exists background_color text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stories'
      and column_name = 'image_url'
  ) then
    execute '
      update public.stories
      set media_url = image_url
      where media_url is null
        and image_url is not null
    ';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stories'
      and column_name = 'content'
  ) then
    execute '
      update public.stories
      set caption = content
      where caption is null
        and content is not null
    ';
  end if;

  update public.stories
  set story_type = 'text',
      background_color = coalesce(background_color, 'purple')
  where media_url is null
    and coalesce(caption, '') <> '';

  update public.stories
  set story_type = 'video'
  where media_type = 'video'
    and story_type <> 'text';

  update public.stories
  set story_type = 'image'
  where story_type not in ('text', 'video');

  if exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'stories'
      and constraint_name = 'stories_payload_check'
  ) then
    alter table public.stories drop constraint stories_payload_check;
  end if;

  if exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'stories'
      and constraint_name = 'stories_story_type_check'
  ) then
    alter table public.stories drop constraint stories_story_type_check;
  end if;

  if exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'stories'
      and constraint_name = 'stories_background_color_check'
  ) then
    alter table public.stories drop constraint stories_background_color_check;
  end if;

  alter table public.stories
  add constraint stories_story_type_check
  check (story_type in ('text', 'image', 'video'));

  alter table public.stories
  add constraint stories_background_color_check
  check (
    background_color is null
    or background_color in ('purple', 'pink', 'blue', 'orange', 'green', 'dark')
  );

  alter table public.stories
  add constraint stories_payload_check
  check (
    (story_type = 'text' and coalesce(caption, '') <> '')
    or (story_type in ('image', 'video') and media_url is not null)
  );
end
$$;

commit;
