-- Agrega campo de firma digital a la tabla de pastores
ALTER TABLE public.pastors
  ADD COLUMN IF NOT EXISTS signature_data text DEFAULT NULL;

COMMENT ON COLUMN public.pastors.signature_data IS 'Firma digital del pastor en formato base64 PNG';
