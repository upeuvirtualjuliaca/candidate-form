-- ============================================================
-- Migration: add_marital_status
-- Description: Adds marital_status and wedding_date to candidates.
--              Values: 'single' | 'divorced' | 'widowed' | 'married' | 'other'
--              Default: 'single'
-- ============================================================

alter table public.candidates
  add column if not exists marital_status text not null default 'single',
  add column if not exists wedding_date   date;
