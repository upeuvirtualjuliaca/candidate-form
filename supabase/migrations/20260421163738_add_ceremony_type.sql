-- ============================================================
-- Migration: add_ceremony_type
-- Description: Adds ceremony_type to candidates table.
--              Values: 'baptism' | 'rebaptism' | 'faith_profession'
-- ============================================================

alter table public.candidates
  add column if not exists ceremony_type text not null default 'baptism';
