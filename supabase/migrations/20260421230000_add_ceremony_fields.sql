-- Add ceremony tab fields
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS ceremony_date               DATE,
  ADD COLUMN IF NOT EXISTS ceremony_place              TEXT,
  ADD COLUMN IF NOT EXISTS officiating_pastor          TEXT,
  ADD COLUMN IF NOT EXISTS officiating_pastor_dni      TEXT,
  ADD COLUMN IF NOT EXISTS receiving_church            TEXT,
  ADD COLUMN IF NOT EXISTS church_city                 TEXT,
  ADD COLUMN IF NOT EXISTS administrative_meeting_date DATE,
  ADD COLUMN IF NOT EXISTS ceremony_notes              TEXT;
