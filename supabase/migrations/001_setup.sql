-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query)

-- Pad configurations table
CREATE TABLE IF NOT EXISTS pad_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pad_index integer NOT NULL CHECK (pad_index >= 0 AND pad_index < 16),
  sound text NOT NULL DEFAULT 'kick',
  label text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT 'red',
  icon text NOT NULL DEFAULT '🥁',
  custom_track_path text,
  custom_track_name text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, pad_index)
);

ALTER TABLE pad_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own pad configs"
  ON pad_configs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Storage bucket for custom audio tracks
-- Also run this, or create the bucket manually in Storage → New bucket (name: custom-tracks, private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('custom-tracks', 'custom-tracks', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users manage own audio files"
  ON storage.objects FOR ALL
  USING (bucket_id = 'custom-tracks' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'custom-tracks' AND auth.uid()::text = (storage.foldername(name))[1]);
