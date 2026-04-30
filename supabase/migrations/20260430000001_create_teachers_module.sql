-- ── Teachers table ─────────────────────────────────────────────────────────
create table public.teachers (
  id                uuid        primary key default gen_random_uuid(),
  dni               text        not null unique,
  full_name         text        not null,
  doc_type          text,
  academic_degree   text,
  dedication_regime text,
  labor_condition   text,
  campus            text,
  faculty           text,
  main_ep           text,
  condition         text,
  created_at        timestamptz not null default now()
);

create index idx_teachers_dni on public.teachers (dni);

-- ── Add teacher_id to candidates ────────────────────────────────────────────
alter table public.candidates
  add column teacher_id uuid references public.teachers(id);

-- ── Add source_type to import_logs ──────────────────────────────────────────
-- Default 'students' keeps all existing rows consistent
alter table public.import_logs
  add column source_type text not null default 'students';
