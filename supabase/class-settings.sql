create table if not exists public.class_settings (
  class_code text primary key,
  student_messaging boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.class_settings enable row level security;

drop policy if exists class_settings_select on public.class_settings;
create policy class_settings_select on public.class_settings
for select to authenticated
using (public.is_member(class_code));

drop policy if exists class_settings_write on public.class_settings;
create policy class_settings_write on public.class_settings
for all to authenticated
using (public.is_teacher(class_code))
with check (public.is_teacher(class_code));

revoke all on public.class_settings from anon, authenticated;
grant select, insert, update, delete on public.class_settings to authenticated;
