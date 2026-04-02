CREATE TABLE IF NOT EXISTS weekly_checklist (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start date NOT NULL,
  description text NOT NULL,
  assigned_to uuid REFERENCES team_members(id),
  is_done boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE weekly_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to weekly_checklist"
  ON weekly_checklist FOR ALL
  USING (true)
  WITH CHECK (true);
