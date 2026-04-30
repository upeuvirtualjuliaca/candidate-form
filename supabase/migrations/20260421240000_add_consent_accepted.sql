-- Add consent_accepted flag to candidates
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS consent_accepted BOOLEAN NOT NULL DEFAULT FALSE;
