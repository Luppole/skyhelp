-- Supabase Storage setup for item icons
-- Run in Supabase SQL editor.

-- Create public bucket for item icons
insert into storage.buckets (id, name, public)
values ('item-icons', 'item-icons', true)
on conflict (id) do nothing;

-- Policy: allow public read
create policy "public_read_item_icons" on storage.objects
  for select
  using (bucket_id = 'item-icons');

-- Policy: allow authenticated uploads to item-icons
create policy "auth_write_item_icons" on storage.objects
  for insert
  with check (bucket_id = 'item-icons' and auth.role() = 'authenticated');
