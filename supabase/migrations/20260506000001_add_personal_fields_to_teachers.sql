-- ── Add personal fields to teachers ────────────────────────────────────────
-- Safe migration: all columns are nullable, no existing data is modified.

ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS sex        text,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS country    text,
  ADD COLUMN IF NOT EXISTS phone      text,
  ADD COLUMN IF NOT EXISTS email      text;

COMMENT ON COLUMN public.teachers.sex        IS 'Sexo del docente: M o F';
COMMENT ON COLUMN public.teachers.birth_date IS 'Fecha de nacimiento del docente';
COMMENT ON COLUMN public.teachers.country    IS 'País de residencia del docente';
COMMENT ON COLUMN public.teachers.phone      IS 'Teléfono de contacto del docente';
COMMENT ON COLUMN public.teachers.email      IS 'Correo electrónico del docente';
