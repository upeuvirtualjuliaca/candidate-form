-- ============================================================
-- Migration: add_education_level
-- Description: Adds education_level and education_level_other
--              to the candidates table.
--              Values: 'none' | 'primary' | 'secondary' | 'higher' | 'other'
-- ============================================================

alter table public.candidates
  add column if not exists education_level       text,
  add column if not exists education_level_other text;
