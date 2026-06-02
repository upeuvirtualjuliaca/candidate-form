-- ─────────────────────────────────────────────────────────────────────────────
-- Campaigns module
-- Heart of the registration process: controls when candidate forms can be created.
-- Only one campaign can be active at a time (enforced at application level).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.campaigns (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  start_date date        NOT NULL,
  end_date   date        NOT NULL,
  is_active  boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast active-campaign lookups (called on every candidate form open)
CREATE INDEX IF NOT EXISTS campaigns_is_active_idx  ON public.campaigns (is_active);
CREATE INDEX IF NOT EXISTS campaigns_start_date_idx ON public.campaigns (start_date);

-- Consistent with other tables in this project (no RLS)
ALTER TABLE public.campaigns DISABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.campaigns TO anon, authenticated, service_role;
