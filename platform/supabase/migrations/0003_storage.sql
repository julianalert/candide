-- Private bucket for generated images: creations/{session_id}/{participant_id}/{message_id}.png
-- Nothing reads it directly; the app signs URLs server-side (7-day expiry for galleries).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('creations', 'creations', false, 10485760, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;
