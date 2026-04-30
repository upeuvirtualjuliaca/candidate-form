-- Add ceremony_completed progress flag to candidates
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS ceremony_completed BOOLEAN NOT NULL DEFAULT FALSE;
