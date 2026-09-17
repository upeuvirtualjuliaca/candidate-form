-- Add vote_number to campaigns
-- This field tracks the baptism vote sequence number for each campaign.
-- It auto-increments from the previous campaign's value and is editable.

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS vote_number integer NULL;
