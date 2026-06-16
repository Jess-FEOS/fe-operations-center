ALTER TABLE weekly_checklist ADD COLUMN IF NOT EXISTS is_priority boolean DEFAULT false;
ALTER TABLE weekly_checklist ADD COLUMN IF NOT EXISTS delivery_date date;
