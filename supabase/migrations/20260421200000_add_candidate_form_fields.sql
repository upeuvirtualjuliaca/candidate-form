-- ============================================================
-- Migration: add_candidate_form_fields
-- Description: Adds Identificación, Conversión and Declaración
--              de fe fields to the candidates table, plus
--              per-section completion flags.
-- ============================================================

alter table public.candidates
  -- ── Identificación (datos adicionales) ─────────────────────
  add column if not exists address                  text,
  add column if not exists church                   text,
  add column if not exists pastor                   text,
  add column if not exists baptism_date             date,
  add column if not exists identification_observations text,

  -- ── Conversión ──────────────────────────────────────────────
  add column if not exists conversion_date          date,
  add column if not exists conversion_place         text,
  add column if not exists influential_person       text,
  add column if not exists spiritual_experience     text,
  add column if not exists conversion_observations  text,

  -- ── Declaración de fe ───────────────────────────────────────
  add column if not exists commitment_checks        jsonb not null default '[]'::jsonb,
  add column if not exists faith_answers            jsonb not null default '{}'::jsonb,
  add column if not exists final_declaration        text,
  add column if not exists faith_observations       text,

  -- ── Progreso por sección ────────────────────────────────────
  add column if not exists identification_completed boolean not null default false,
  add column if not exists conversion_completed     boolean not null default false,
  add column if not exists faith_completed          boolean not null default false;
