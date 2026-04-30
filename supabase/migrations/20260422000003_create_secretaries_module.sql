-- ============================================================
-- Migration: create_secretaries_module
-- Table: secretaries (secretarias de iglesia)
-- ============================================================

CREATE TABLE public.secretaries (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dni         text        NOT NULL UNIQUE,
  full_name   text        NOT NULL,
  phone       text,
  church_name text,
  created_at  timestamp   NOT NULL DEFAULT now()
);

CREATE INDEX idx_secretaries_dni      ON public.secretaries(dni);
CREATE INDEX idx_secretaries_fullname ON public.secretaries(full_name);

ALTER TABLE public.secretaries DISABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.secretaries TO anon, authenticated, service_role;
