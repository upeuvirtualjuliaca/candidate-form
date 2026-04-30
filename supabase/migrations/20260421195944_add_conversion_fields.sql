-- ============================================================
-- Migration: add_conversion_fields
-- Description: Adds biblical instructors, previous religion,
--              and three single-choice survey fields to candidates.
-- ============================================================

alter table public.candidates
  add column if not exists biblical_instructor_1 text,
  add column if not exists biblical_instructor_2 text,
  add column if not exists previous_religion      text,
  add column if not exists how_knew_iasd          text,
  add column if not exists how_studied_bible      text,
  add column if not exists decisive_factor        text;
