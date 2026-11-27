create extension if not exists pgcrypto with schema extensions;

create table if not exists public.members (
  id uuid primary key references auth.users(id) on delete cascade,
  class_code text not null,
  name text not null,
  name_lower text not null,
  role text not null check (role in ('student', 'teacher')),
  created_at timestamptz not null default now(),
  unique (class_code, name_lower, role)
);

create table if not exists public.teacher_sections (
  teacher_id uuid not null references auth.users(id) on delete cascade,
  class_code text not null,
  created_at timestamptz not null default now(),
  primary key (teacher_id, class_code)
);

create table if not exists public.messages (
  id uuid primary key default extensions.gen_random_uuid(),
  class_code text not null,
  from_id uuid not null references public.members(id) on delete cascade,
  from_name text not null,
  from_role text not null check (from_role in ('student', 'teacher')),
  to_ids uuid[] not null default '{}',
  to_names text[] not null default '{}',
  subject text not null default '',
  body text not null default '',
  read_by uuid[] not null default '{}',
  starred_by uuid[] not null default '{}',
  deleted_by uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.drafts (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  class_code text not null,
  recipient_text text not null default '',
  subject text not null default '',
  body text not null default '',
  updated_at timestamptz not null default now()
);

create index if not exists messages_class_created_idx on public.messages (class_code, created_at desc);
create index if not exists messages_to_ids_idx on public.messages using gin (to_ids);
create index if not exists drafts_user_updated_idx on public.drafts (user_id, updated_at desc);

create or replace function public.is_member(code text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    exists (
      select 1
      from public.members m
      where m.class_code = code and m.id = auth.uid()
    )
    or exists (
      select 1
      from public.teacher_sections ts
      where ts.class_code = code and ts.teacher_id = auth.uid()
    );
$$;

create or replace function public.is_teacher(code text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1
    from public.teacher_sections ts
    where ts.class_code = code and ts.teacher_id = auth.uid()
  );
$$;

create or replace function public.teacher_exists(code text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1
    from public.teacher_sections ts
    where ts.class_code = code
  );
$$;

create or replace function public.can_create_teacher(code text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select not exists (
    select 1
    from public.teacher_sections ts
    where ts.class_code = code
  );
$$;

create or replace function public.grant_teacher_section()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.role = 'teacher' then
    insert into public.teacher_sections (teacher_id, class_code)
    values (new.id, new.class_code)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop function if exists public.ensure_teacher_section(text);

insert into public.teacher_sections (teacher_id, class_code)
select id, class_code from public.members where role = 'teacher'
on conflict do nothing;

alter table public.teacher_sections enable row level security;

drop policy if exists teacher_sections_select on public.teacher_sections;
create policy teacher_sections_select on public.teacher_sections
for select to authenticated
using (teacher_id = auth.uid());

drop policy if exists teacher_sections_insert on public.teacher_sections;

drop trigger if exists members_teacher_section_grant on public.members;
create trigger members_teacher_section_grant
after insert or update of role, class_code on public.members
for each row execute function public.grant_teacher_section();

drop function if exists public.has_teacher_role();
revoke all on function public.is_member(text) from public, anon;
revoke all on function public.is_teacher(text) from public, anon;
revoke all on function public.teacher_exists(text) from public;
revoke all on function public.can_create_teacher(text) from public, anon;
grant execute on function public.is_member(text) to authenticated;
grant execute on function public.is_teacher(text) to authenticated;
grant execute on function public.teacher_exists(text) to anon, authenticated;
grant execute on function public.can_create_teacher(text) to authenticated;
revoke all on public.teacher_sections from anon, authenticated;
grant select on public.teacher_sections to authenticated;

alter table public.members enable row level security;
alter table public.messages enable row level security;
alter table public.drafts enable row level security;

drop policy if exists members_select on public.members;
create policy members_select on public.members
for select to authenticated
using (id = auth.uid() or public.is_member(class_code));

drop policy if exists members_insert on public.members;
create policy members_insert on public.members
for insert to authenticated
with check (
  class_code ~ '^[A-Za-z0-9-]{3,24}$'
  and char_length(trim(name)) between 1 and 60
  and name_lower = lower(trim(name))
  and role in ('student', 'teacher')
  and (
    (role = 'student' and public.is_teacher(class_code))
    or (role = 'teacher' and id = auth.uid() and public.can_create_teacher(class_code))
  )
);

drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
for select to authenticated
using (
  public.is_member(class_code)
  and (
    from_id = auth.uid()
    or auth.uid() = any(to_ids)
    or public.is_teacher(class_code)
  )
);

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
for insert to authenticated
with check (
  public.is_member(class_code)
  and from_id = auth.uid()
  and coalesce(array_length(to_ids, 1), 0) > 0
  and auth.uid() = any(read_by)
  and coalesce(array_length(starred_by, 1), 0) = 0
  and coalesce(array_length(deleted_by, 1), 0) = 0
);

drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages
for update to authenticated
using (
  public.is_member(class_code)
  and (from_id = auth.uid() or auth.uid() = any(to_ids) or public.is_teacher(class_code))
)
with check (
  public.is_member(class_code)
  and (from_id = auth.uid() or auth.uid() = any(to_ids) or public.is_teacher(class_code))
);

drop policy if exists messages_delete on public.messages;
create policy messages_delete on public.messages
for delete to authenticated
using (
  public.is_member(class_code)
  and auth.uid() = any(deleted_by)
  and (from_id = auth.uid() or auth.uid() = any(to_ids) or public.is_teacher(class_code))
);

drop policy if exists drafts_all on public.drafts;
create policy drafts_all on public.drafts
for all to authenticated
using (user_id = auth.uid() and public.is_member(class_code))
with check (user_id = auth.uid() and public.is_member(class_code));

revoke all on public.members from anon, authenticated;
grant select, insert on public.members to authenticated;

revoke all on public.messages from anon, authenticated;
grant select, insert, delete on public.messages to authenticated;
grant update (read_by, starred_by, deleted_by) on public.messages to authenticated;

revoke all on public.drafts from anon, authenticated;
grant select, insert, update, delete on public.drafts to authenticated;
