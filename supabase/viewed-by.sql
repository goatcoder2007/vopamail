create table if not exists public.item_views (
  item_type text not null check (item_type in ('message', 'assignment', 'announcement')),
  item_id uuid not null,
  class_code text not null,
  viewer_id uuid not null references public.members(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (item_type, item_id, viewer_id)
);

create index if not exists item_views_class_item_idx on public.item_views (class_code, item_type, item_id);
create index if not exists item_views_viewer_idx on public.item_views (viewer_id);

alter table public.item_views enable row level security;

drop policy if exists item_views_select on public.item_views;
create policy item_views_select on public.item_views
for select to authenticated
using (viewer_id = auth.uid() or public.is_teacher(class_code));

revoke all on public.item_views from anon, authenticated;
grant select on public.item_views to authenticated;
grant insert (item_type, item_id, class_code, viewer_id) on public.item_views to authenticated;

create or replace function public.mark_item_viewed(p_item_type text, p_item_id uuid, p_class_code text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  if p_item_type not in ('message', 'assignment', 'announcement') then
    raise exception 'Unsupported item type';
  end if;

  if not public.is_member(p_class_code) then
    raise exception 'Not a member of this class';
  end if;

  if p_item_type = 'message' then
    if not exists (
      select 1
      from public.messages m
      where m.id = p_item_id
        and m.class_code = p_class_code
        and (m.from_id = auth.uid() or auth.uid() = any(m.to_ids) or public.is_teacher(p_class_code))
    ) then
      raise exception 'Message not found';
    end if;
  elsif p_item_type = 'assignment' then
    if not exists (
      select 1
      from public.assignments a
      where a.id = p_item_id and a.class_code = p_class_code
    ) then
      raise exception 'Assignment not found';
    end if;
  else
    if not exists (
      select 1
      from public.announcements a
      where a.id = p_item_id and a.class_code = p_class_code
    ) then
      raise exception 'Announcement not found';
    end if;
  end if;

  insert into public.item_views (item_type, item_id, class_code, viewer_id)
  values (p_item_type, p_item_id, p_class_code, auth.uid())
  on conflict (item_type, item_id, viewer_id) do nothing;
end;
$$;

revoke all on function public.mark_item_viewed(text, uuid, text) from public, anon;
grant execute on function public.mark_item_viewed(text, uuid, text) to authenticated;

create or replace function public.cleanup_item_views()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  view_type text;
begin
  if tg_table_name = 'messages' then
    view_type := 'message';
  elsif tg_table_name = 'assignments' then
    view_type := 'assignment';
  elsif tg_table_name = 'announcements' then
    view_type := 'announcement';
  else
    return old;
  end if;

  delete from public.item_views
  where item_type = view_type and item_id = old.id and class_code = old.class_code;
  return old;
end;
$$;

drop trigger if exists messages_item_views_cleanup on public.messages;
create trigger messages_item_views_cleanup
after delete on public.messages
for each row execute function public.cleanup_item_views();

drop trigger if exists assignments_item_views_cleanup on public.assignments;
create trigger assignments_item_views_cleanup
after delete on public.assignments
for each row execute function public.cleanup_item_views();

drop trigger if exists announcements_item_views_cleanup on public.announcements;
create trigger announcements_item_views_cleanup
after delete on public.announcements
for each row execute function public.cleanup_item_views();
