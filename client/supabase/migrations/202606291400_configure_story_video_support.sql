begin;

alter table public.stories
add column if not exists media_url text;

alter table public.stories
add column if not exists media_type text not null default 'image';

alter table public.stories
add column if not exists caption text;

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

  if exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'stories'
      and constraint_name = 'stories_payload_check'
  ) then
    alter table public.stories drop constraint stories_payload_check;
  end if;

  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'stories'
      and constraint_name = 'stories_payload_check'
  ) then
    alter table public.stories
    add constraint stories_payload_check
    check (coalesce(caption, '') <> '' or media_url is not null);
  end if;

  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'stories'
      and constraint_name = 'stories_media_type_check'
  ) then
    alter table public.stories
    add constraint stories_media_type_check
    check (media_type in ('image', 'video'));
  end if;
end
$$;

update storage.buckets
set
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ],
  file_size_limit = 26214400
where id = 'stories';

commit;
