-- Boards table with RLS
CREATE TABLE IF NOT EXISTS boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'My Board',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE boards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own boards" ON boards;
CREATE POLICY "Users manage own boards"
  ON boards FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- user_settings: additional columns added after initial migration
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS theme text DEFAULT 'dark';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS active_board_id uuid REFERENCES boards(id) ON DELETE SET NULL;

-- pad_configs: board association
ALTER TABLE pad_configs ADD COLUMN IF NOT EXISTS board_id uuid REFERENCES boards(id) ON DELETE CASCADE;
