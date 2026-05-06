-- ── Add guardian signature field to candidates ──────────────────────────────
-- Safe: nullable column, no existing data modified.
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS guardian_signature_data text;

COMMENT ON COLUMN public.candidates.guardian_signature_data IS 'Firma del responsable/tutor (base64 PNG) — solo para candidatos menores de edad';
