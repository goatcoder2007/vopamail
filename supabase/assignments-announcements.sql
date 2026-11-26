create extension if not exists pgcrypto with schema extensions;

create table if not exists public.assignments (
  id uuid primary key default extensions.gen_random_uuid(),
  class_code text not null,
  teacher_id uuid not null references public.members(id) on delete cascade,
  title text not null,
  instructions text not null default '',
  due_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.assignment_submissions (
  id uuid primary key default extensions.gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  class_code text not null,
  student_id uuid not null references public.members(id) on delete cascade,
  body text not null default '',
  grade text,
  feedback text not null default '',
  graded_at timestamptz,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);

create table if not exists public.submission_files (
  id uuid primary key default extensions.gen_random_uuid(),
  submission_id uuid not null references public.assignment_submissions(id) on delete cascade,
  class_code text not null,
  student_id uuid not null references public.members(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  size_bytes bigint not null,
  mime_type text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default extensions.gen_random_uuid(),
  class_code text not null,
  author_id uuid not null references public.members(id) on delete cascade,
  title text not null,
  body text not null default '',
  created_at timestamptz not null default now()
);

alter table public.assignments add column if not exists id uuid default extensions.gen_random_uuid();
alter table public.assignments add column if not exists class_code text;
alter table public.assignments add column if not exists teacher_id uuid;
alter table public.assignments add column if not exists title text;
alter table public.assignments add column if not exists instructions text default '';
alter table public.assignments add column if not exists due_at timestamptz;
alter table public.assignments add column if not exists created_at timestamptz default now();

alter table public.assignment_submissions add column if not exists id uuid default extensions.gen_random_uuid();
alter table public.assignment_submissions add column if not exists assignment_id uuid;
alter table public.assignment_submissions add column if not exists class_code text;
alter table public.assignment_submissions add column if not exists student_id uuid;
alter table public.assignment_submissions add column if not exists body text default '';
alter table public.assignment_submissions add column if not exists grade text;
alter table public.assignment_submissions add column if not exists feedback text default '';
alter table public.assignment_submissions add column if not exists graded_at timestamptz;
alter table public.assignment_submissions add column if not exists submitted_at timestamptz default now();
alter table public.assignment_submissions add column if not exists created_at timestamptz default now();

alter table public.submission_files add column if not exists id uuid default extensions.gen_random_uuid();
alter table public.submission_files add column if not exists submission_id uuid;
alter table public.submission_files add column if not exists class_code text;
alter table public.submission_files add column if not exists student_id uuid;
alter table public.submission_files add column if not exists file_name text;
alter table public.submission_files add column if not exists storage_path text;
alter table public.submission_files add column if not exists size_bytes bigint;
alter table public.submission_files add column if not exists mime_type text;
alter table public.submission_files add column if not exists created_at timestamptz default now();

alter table public.announcements add column if not exists id uuid default extensions.gen_random_uuid();
alter table public.announcements add column if not exists class_code text;
alter table public.announcements add column if not exists author_id uuid;
alter table public.announcements add column if not exists title text;
alter table public.announcements add column if not exists body text default '';
alter table public.announcements add column if not exists created_at timestamptz default now();

create index if not exists assignments_class_created_idx on public.assignments (class_code, created_at desc);
create index if not exists assignment_submissions_class_submitted_idx on public.assignment_submissions (class_code, submitted_at desc);
create index if not exists submission_files_submission_idx on public.submission_files (submission_id);
create index if not exists announcements_class_created_idx on public.announcements (class_code, created_at desc);

alter table public.assignments enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.submission_files enable row level security;
alter table public.announcements enable row level security;

drop policy if exists assignments_select on public.assignments;
create policy assignments_select on public.assignments
for select to authenticated
using (public.is_member(class_code));

drop policy if exists assignments_insert on public.assignments;
create policy assignments_insert on public.assignments
for insert to authenticated
with check (
  public.is_teacher(class_code)
  and teacher_id = auth.uid()
);

drop policy if exists assignments_update on public.assignments;
create policy assignments_update on public.assignments
for update to authenticated
using (public.is_teacher(class_code) and teacher_id = auth.uid())
with check (
  public.is_teacher(class_code)
  and teacher_id = auth.uid()
);

drop policy if exists assignments_delete on public.assignments;
create policy assignments_delete on public.assignments
for delete to authenticated
using (public.is_teacher(class_code) and teacher_id = auth.uid());

drop policy if exists announcements_select on public.announcements;
create policy announcements_select on public.announcements
for select to authenticated
using (public.is_member(class_code));

drop policy if exists announcements_insert on public.announcements;
create policy announcements_insert on public.announcements
for insert to authenticated
with check (
  public.is_teacher(class_code)
  and author_id = auth.uid()
);

drop policy if exists announcements_update on public.announcements;
create policy announcements_update on public.announcements
for update to authenticated
using (public.is_teacher(class_code) and author_id = auth.uid())
with check (
  public.is_teacher(class_code)
  and author_id = auth.uid()
);

drop policy if exists announcements_delete on public.announcements;
create policy announcements_delete on public.announcements
for delete to authenticated
using (public.is_teacher(class_code) and author_id = auth.uid());

drop policy if exists assignment_submissions_select on public.assignment_submissions;
create policy assignment_submissions_select on public.assignment_submissions
for select to authenticated
using (
  public.is_member(class_code)
  and (
    student_id = auth.uid()
    or public.is_teacher(class_code)
  )
);

drop policy if exists assignment_submissions_insert on public.assignment_submissions;
create policy assignment_submissions_insert on public.assignment_submissions
for insert to authenticated
with check (
  public.is_member(class_code)
  and student_id = auth.uid()
  and graded_at is null
  and grade is null
  and feedback = ''
  and exists (
    select 1
    from public.assignments a
    where a.id = assignment_id
      and a.class_code = class_code
  )
);

drop policy if exists assignment_submissions_update on public.assignment_submissions;
create policy assignment_submissions_update on public.assignment_submissions
for update to authenticated
using (
  public.is_member(class_code)
  and student_id = auth.uid()
  and graded_at is null
)
with check (
  public.is_member(class_code)
  and student_id = auth.uid()
  and graded_at is null
  and grade is null
  and feedback = ''
);

drop policy if exists submission_files_select on public.submission_files;
create policy submission_files_select on public.submission_files
for select to authenticated
using (
  public.is_member(class_code)
  and (
    student_id = auth.uid()
    or public.is_teacher(class_code)
  )
);

drop policy if exists submission_files_insert on public.submission_files;
create policy submission_files_insert on public.submission_files
for insert to authenticated
with check (
  public.is_member(class_code)
  and student_id = auth.uid()
  and exists (
    select 1
    from public.assignment_submissions s
    where s.id = submission_id
      and s.class_code = class_code
      and s.student_id = auth.uid()
  )
);

drop policy if exists submission_files_delete on public.submission_files;
create policy submission_files_delete on public.submission_files
for delete to authenticated
using (
  public.is_member(class_code)
  and (
    student_id = auth.uid()
    or public.is_teacher(class_code)
  )
);

create or replace function public.grade_submission(
  p_submission_id uuid,
  p_grade text,
  p_feedback text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_class_code text;
begin
  select s.class_code
  into v_class_code
  from public.assignment_submissions s
  where s.id = p_submission_id;

  if v_class_code is null then
    raise exception 'Submission not found';
  end if;

  if not public.is_teacher(v_class_code) then
    raise exception 'Not authorized';
  end if;

  update public.assignment_submissions
  set
    grade = p_grade,
    feedback = coalesce(p_feedback, ''),
    graded_at = now()
  where id = p_submission_id;
end;
$$;

revoke all on function public.grade_submission(uuid, text, text) from public;
grant execute on function public.grade_submission(uuid, text, text) to authenticated;

drop policy if exists class_files_insert on storage.objects;
create policy class_files_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'class-files'
  and public.is_member(split_part(name, '/', 1))
  and (
    split_part(name, '/', 2) <> 'submissions'
    or (
      split_part(name, '/', 3) = auth.uid()::text
      or public.is_teacher(split_part(name, '/', 1))
    )
  )
);

drop policy if exists class_files_delete on storage.objects;
create policy class_files_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'class-files'
  and public.is_member(split_part(name, '/', 1))
  and (
    split_part(name, '/', 2) <> 'submissions'
    or (
      split_part(name, '/', 3) = auth.uid()::text
      or public.is_teacher(split_part(name, '/', 1))
    )
  )
);

revoke all on public.assignments from anon, authenticated;
grant select, insert, update, delete on public.assignments to authenticated;

revoke all on public.assignment_submissions from anon, authenticated;
grant select, insert on public.assignment_submissions to authenticated;
grant update (body, submitted_at) on public.assignment_submissions to authenticated;

revoke all on public.submission_files from anon, authenticated;
grant select, insert, delete on public.submission_files to authenticated;

revoke all on public.announcements from anon, authenticated;
grant select, insert, update, delete on public.announcements to authenticated;
