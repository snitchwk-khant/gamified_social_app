drop trigger if exists post_reactions_create_notification on public.post_reactions;

create trigger post_reactions_create_notification
after insert or update on public.post_reactions
for each row
execute function public.create_post_reaction_notification();
