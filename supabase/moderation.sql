create table if not exists public.moderation_alerts (
  id uuid primary key default extensions.gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  class_code text not null,
  from_id uuid not null,
  from_name text not null default '',
  to_names text[] not null default '{}',
  subject text not null default '',
  snippet text not null default '',
  flagged_terms text[] not null default '{}',
  severity text not null default 'medium',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);

alter table public.messages add column if not exists moderation_status text not null default 'clean';
alter table public.messages add column if not exists flagged_terms text[] not null default '{}';
alter table public.messages add column if not exists flagged_at timestamptz;

alter table public.moderation_alerts enable row level security;

drop policy if exists moderation_alerts_select on public.moderation_alerts;
create policy moderation_alerts_select on public.moderation_alerts
for select to authenticated
using (public.is_teacher(class_code));

drop policy if exists moderation_alerts_insert on public.moderation_alerts;
create policy moderation_alerts_insert on public.moderation_alerts
for insert to authenticated
with check (from_id = auth.uid() and public.is_member(class_code));

drop policy if exists moderation_alerts_update on public.moderation_alerts;
create policy moderation_alerts_update on public.moderation_alerts
for update to authenticated
using (public.is_teacher(class_code))
with check (public.is_teacher(class_code));

grant select, insert, update on public.moderation_alerts to authenticated;
