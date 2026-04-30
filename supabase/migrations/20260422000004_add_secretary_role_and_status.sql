ALTER TABLE public.secretaries
  ADD COLUMN role      text    NOT NULL DEFAULT 'asociada' CHECK (role IN ('principal', 'asociada')),
  ADD COLUMN is_active boolean NOT NULL DEFAULT true;
