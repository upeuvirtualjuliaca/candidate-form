-- ============================================================
-- Migration: create_pastors_module
-- Tables: faculties → programs (escuelas profesionales)
--         pastors → pastor_programs (many-to-many)
-- ============================================================

-- 1. Facultades
CREATE TABLE public.faculties (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL UNIQUE,
  created_at timestamp   NOT NULL DEFAULT now()
);

-- 2. Escuelas profesionales (pertenecen a una facultad)
CREATE TABLE public.programs (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  faculty_id uuid        NOT NULL REFERENCES public.faculties(id) ON DELETE CASCADE,
  created_at timestamp   NOT NULL DEFAULT now(),
  UNIQUE(name, faculty_id)
);

CREATE INDEX idx_programs_faculty ON public.programs(faculty_id);

-- 3. Pastores
CREATE TABLE public.pastors (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dni        text        NOT NULL UNIQUE,
  full_name  text        NOT NULL,
  created_at timestamp   NOT NULL DEFAULT now()
);

CREATE INDEX idx_pastors_dni      ON public.pastors(dni);
CREATE INDEX idx_pastors_fullname ON public.pastors(full_name);

-- 4. Relación pastor ↔ escuelas (muchos a muchos)
CREATE TABLE public.pastor_programs (
  pastor_id  uuid NOT NULL REFERENCES public.pastors(id)  ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  PRIMARY KEY (pastor_id, program_id)
);

-- ============================================================
-- Seed: facultades y escuelas profesionales de ejemplo
-- (ajustar según la institución real)
-- ============================================================

WITH fac AS (
  INSERT INTO public.faculties (name) VALUES
    ('Facultad de Ciencias Empresariales'),
    ('Facultad de Ingeniería y Arquitectura'),
    ('Facultad de Ciencias de la Salud'),
    ('Facultad de Ciencias Humanas y Educación'),
    ('Facultad de Teología')
  RETURNING id, name
)
INSERT INTO public.programs (name, faculty_id)
SELECT prog.name, fac.id
FROM fac
JOIN (VALUES
  -- Ciencias Empresariales
  ('Administración de Empresas',          'Facultad de Ciencias Empresariales'),
  ('Contabilidad y Finanzas',             'Facultad de Ciencias Empresariales'),
  ('Turismo y Hotelería',                 'Facultad de Ciencias Empresariales'),
  ('Marketing y Negocios Internacionales','Facultad de Ciencias Empresariales'),
  -- Ingeniería y Arquitectura
  ('Ingeniería de Sistemas',             'Facultad de Ingeniería y Arquitectura'),
  ('Ingeniería Civil',                    'Facultad de Ingeniería y Arquitectura'),
  ('Ingeniería Ambiental',               'Facultad de Ingeniería y Arquitectura'),
  ('Arquitectura',                        'Facultad de Ingeniería y Arquitectura'),
  -- Ciencias de la Salud
  ('Enfermería',                          'Facultad de Ciencias de la Salud'),
  ('Nutrición y Dietética',              'Facultad de Ciencias de la Salud'),
  ('Psicología',                          'Facultad de Ciencias de la Salud'),
  ('Medicina Humana',                     'Facultad de Ciencias de la Salud'),
  -- Ciencias Humanas y Educación
  ('Educación',                           'Facultad de Ciencias Humanas y Educación'),
  ('Trabajo Social',                      'Facultad de Ciencias Humanas y Educación'),
  ('Arte y Diseño Gráfico',              'Facultad de Ciencias Humanas y Educación'),
  -- Teología
  ('Teología',                            'Facultad de Teología')
) AS prog(name, faculty_name) ON fac.name = prog.faculty_name;
