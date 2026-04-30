ALTER TABLE public.secretaries
  ADD COLUMN is_historical boolean NOT NULL DEFAULT false;

CREATE INDEX idx_secretaries_historical ON public.secretaries(is_historical);
