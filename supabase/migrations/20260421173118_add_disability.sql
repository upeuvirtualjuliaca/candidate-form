-- ============================================================
-- Migration: add_disability
-- Description: Adds disability fields to candidates table.
-- ============================================================

alter table public.candidates
  add column if not exists has_disability   boolean not null default false,
  add column if not exists disability_types jsonb   not null default '[]'::jsonb;
