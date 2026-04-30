-- Add guardian fields for minor candidates
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS guardian_1_name     TEXT,
  ADD COLUMN IF NOT EXISTS guardian_1_document TEXT,
  ADD COLUMN IF NOT EXISTS guardian_2_name     TEXT,
  ADD COLUMN IF NOT EXISTS guardian_2_document TEXT;
