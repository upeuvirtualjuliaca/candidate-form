-- Add campaign_id to candidates to track which campaign each ficha belongs to
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_candidates_campaign_id ON candidates(campaign_id);
