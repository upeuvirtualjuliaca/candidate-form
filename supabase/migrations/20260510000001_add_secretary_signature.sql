-- Agrega campo de firma digital a la tabla de secretarias
ALTER TABLE public.secretaries
  ADD COLUMN IF NOT EXISTS signature_data text DEFAULT NULL;

COMMENT ON COLUMN public.secretaries.signature_data IS 'Firma digital de la secretaria en formato base64 PNG';
