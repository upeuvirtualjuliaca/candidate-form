-- Archivar todas las secretarias principales excepto la más reciente
UPDATE public.secretaries
SET is_historical = true,
    is_active     = false
WHERE role = 'principal'
  AND id != (
    SELECT id FROM public.secretaries
    WHERE role = 'principal'
    ORDER BY created_at DESC
    LIMIT 1
  );
