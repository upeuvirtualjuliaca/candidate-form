-- ============================================================
-- Migration: pastors_rls_policies
-- Grants full access to authenticated and anon roles on the
-- pastors module tables (faculties, programs, pastors, pastor_programs).
-- RLS is disabled so the anon/service key can operate freely.
-- ============================================================

ALTER TABLE public.faculties      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pastors        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pastor_programs DISABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.faculties       TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.programs        TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.pastors         TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.pastor_programs TO anon, authenticated, service_role;
