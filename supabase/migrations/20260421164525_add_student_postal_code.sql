-- ============================================================
-- Migration: add_student_postal_code
-- Description: Adds postal_code column to the students table.
-- ============================================================

alter table public.students
  add column if not exists postal_code text;
