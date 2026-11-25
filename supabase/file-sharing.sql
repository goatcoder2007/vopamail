create extension if not exists pgcrypto with schema extensions;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'class-files',
  'class-files',
  false,
  10485760,
  array[
    'image/png', 'image/jpeg', 'image/gif', 'image/webp',
    'application/pdf', 'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.message_files (
  id uuid primary key default extensions.gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  class_code text not null,
  from_id uuid not null references public.members(id) on delete cascade,
  to_ids uuid[] not null default '{}',
  file_name text not null,
  storage_path text not null,
  size_bytes bigint not null,
  mime_type text not null,
  created_at timestamptz not null default now()
);

create index if not exists message_files_message_idx on public.message_files (message_id);

alter table public.drafts add column if not exists attachments jsonb not null default '[]'::jsonb;

alter table public.message_files enable row level security;

drop policy if exists message_files_select on public.message_files;
create policy message_files_select on public.message_files
for select to authenticated
using (
  public.is_member(class_code)
  and (
    from_id = auth.uid()
    or auth.uid() = any(to_ids)
    or public.is_teacher(class_code)
  )
);

drop policy if exists message_files_insert on public.message_files;
create policy message_files_insert on public.message_files
for insert to authenticated
with check (
  public.is_member(class_code)
  and from_id = auth.uid()
);

revoke all on public.message_files from anon, authenticated;
grant select, insert on public.message_files to authenticated;

drop policy if exists class_files_select on storage.objects;
create policy class_files_select on storage.objects
for select to authenticated
using (
  bucket_id = 'class-files'
  and public.is_member(split_part(name, '/', 1))
);

drop policy if exists class_files_insert on storage.objects;
create policy class_files_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'class-files'
  and public.is_member(split_part(name, '/', 1))
);

drop policy if exists class_files_delete on storage.objects;
create policy class_files_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'class-files'
  and public.is_member(split_part(name, '/', 1))
);
