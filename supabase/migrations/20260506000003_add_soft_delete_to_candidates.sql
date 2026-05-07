-- ── Soft delete para candidates ───────────────────────────────────────────────
-- Safe: columna nullable, ningún registro existente se modifica.
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN public.candidates.deleted_at IS
  'Soft delete: cuando no es NULL la ficha está eliminada lógicamente. NULL = activo.';
