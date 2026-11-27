drop policy if exists class_files_select on storage.objects;
create policy class_files_select on storage.objects
for select to authenticated
using (
  bucket_id = 'class-files'
  and (
    exists (
      select 1
      from public.message_files mf
      where mf.storage_path = name
        and mf.class_code = split_part(name, '/', 1)
        and (
          mf.from_id = auth.uid()
          or auth.uid() = any(mf.to_ids)
          or public.is_teacher(mf.class_code)
        )
    )
    or exists (
      select 1
      from public.submission_files sf
      where sf.storage_path = name
        and sf.class_code = split_part(name, '/', 1)
        and (
          sf.student_id = auth.uid()
          or public.is_teacher(sf.class_code)
        )
    )
  )
);

drop policy if exists class_files_insert on storage.objects;
create policy class_files_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'class-files'
  and public.is_member(split_part(name, '/', 1))
  and (
    (
      split_part(name, '/', 2) <> 'submissions'
      and array_length(string_to_array(name, '/'), 1) = 2
    )
    or (
      split_part(name, '/', 2) = 'submissions'
      and array_length(string_to_array(name, '/'), 1) = 4
      and split_part(name, '/', 3) = auth.uid()::text
    )
  )
);

drop policy if exists class_files_delete on storage.objects;
create policy class_files_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'class-files'
  and (
    exists (
      select 1
      from public.message_files mf
      where mf.storage_path = name
        and mf.class_code = split_part(name, '/', 1)
        and (mf.from_id = auth.uid() or public.is_teacher(mf.class_code))
    )
    or exists (
      select 1
      from public.submission_files sf
      where sf.storage_path = name
        and sf.class_code = split_part(name, '/', 1)
        and (sf.student_id = auth.uid() or public.is_teacher(sf.class_code))
    )
  )
);
