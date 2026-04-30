-- ============================================================
-- Migration: init_schema
-- Description: Initial schema for candidate registration system
-- ============================================================

-- 1. students
create table public.students (
  id               uuid        primary key default gen_random_uuid(),
  external_id      text,
  student_code     text,
  dni              text        unique not null,
  full_name        text,
  sex              text,
  institutional_email text,
  phone            text,
  program          text,
  faculty          text,
  campus           text,
  modality         text,
  cycle            text,
  "group"          text,
  country          text,
  birth_date       date,
  created_at       timestamp   not null default now()
);

create index idx_students_dni on public.students (dni);

-- 2. users
create table public.users (
  id         uuid      primary key default gen_random_uuid(),
  name       text,
  email      text      unique not null,
  created_at timestamp not null default now()
);

-- 3. roles
create table public.roles (
  id         uuid      primary key default gen_random_uuid(),
  name       text      unique not null,
  created_at timestamp not null default now()
);

-- 4. user_roles (pivot)
create table public.user_roles (
  id         uuid      primary key default gen_random_uuid(),
  user_id    uuid      not null references public.users(id) on delete cascade,
  role_id    uuid      not null references public.roles(id) on delete cascade,
  created_at timestamp not null default now(),
  unique (user_id, role_id)
);

-- 5. candidates
create table public.candidates (
  id           uuid      primary key default gen_random_uuid(),
  student_id   uuid      references public.students(id),
  created_by   uuid      references public.users(id),
  observations text,
  status       text      not null default 'draft',
  created_at   timestamp not null default now()
);

create index idx_candidates_student_id on public.candidates (student_id);

-- 6. candidate_documents
create table public.candidate_documents (
  id            uuid      primary key default gen_random_uuid(),
  candidate_id  uuid      not null references public.candidates(id) on delete cascade,
  document_name text,
  file_url      text,
  created_at    timestamp not null default now()
);

-- 7. candidate_experience
create table public.candidate_experience (
  id           uuid      primary key default gen_random_uuid(),
  candidate_id uuid      not null references public.candidates(id) on delete cascade,
  company      text,
  position     text,
  start_date   date,
  end_date     date,
  description  text,
  created_at   timestamp not null default now()
);

-- 8. candidate_education
create table public.candidate_education (
  id           uuid      primary key default gen_random_uuid(),
  candidate_id uuid      not null references public.candidates(id) on delete cascade,
  institution  text,
  degree       text,
  start_date   date,
  end_date     date,
  created_at   timestamp not null default now()
);
