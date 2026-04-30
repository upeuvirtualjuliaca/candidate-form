-- ============================================================
-- Migration: add_import_logs
-- Description: Table to track Excel import operations
-- ============================================================

create table public.import_logs (
  id                uuid        primary key default gen_random_uuid(),
  file_name         text        not null,
  total_records     integer     not null default 0,
  inserted_records  integer     not null default 0,
  duplicate_records integer     not null default 0,
  error_records     integer     not null default 0,
  -- 'success' | 'partial' | 'error'
  status            text        not null default 'success',
  created_by        uuid        references public.users(id),
  created_at        timestamp   not null default now()
);

create index idx_import_logs_created_at on public.import_logs (created_at desc);
