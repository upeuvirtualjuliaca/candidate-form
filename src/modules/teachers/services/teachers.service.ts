import { supabase } from '@/core/supabase'

// ── Types ──────────────────────────────────────────────────────────────────

export interface Teacher {
  id:               string
  dni:              string
  full_name:        string
  doc_type:         string | null
  academic_degree:  string | null
  dedication_regime: string | null
  labor_condition:  string | null
  campus:           string | null
  faculty:          string | null
  main_ep:          string | null
  condition:        string | null
}

export interface PaginatedTeachers {
  data:  Teacher[]
  count: number
}

// ── Queries ────────────────────────────────────────────────────────────────

const LIST_FIELDS = 'id, dni, full_name, academic_degree, dedication_regime, faculty, campus, main_ep'

export async function getTeachersPaginated(
  page:     number = 1,
  pageSize: number = 10,
): Promise<PaginatedTeachers> {
  const from = (page - 1) * pageSize
  const to   = from + pageSize - 1

  const { data, count, error } = await supabase
    .from('teachers')
    .select(LIST_FIELDS, { count: 'exact' })
    .order('full_name', { ascending: true })
    .range(from, to)

  if (error) throw error
  return { data: (data ?? []) as Teacher[], count: count ?? 0 }
}

export async function searchTeachers(params: {
  dni?:  string
  name?: string
}): Promise<Teacher[]> {
  if (!params.dni?.trim() && !params.name?.trim()) return []

  let query = supabase
    .from('teachers')
    .select(LIST_FIELDS)
    .order('full_name', { ascending: true })
    .limit(50)

  if (params.dni?.trim()) {
    query = query.eq('dni', params.dni.trim())
  } else if (params.name?.trim()) {
    query = query.ilike('full_name', `%${params.name.trim()}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Teacher[]
}

/** Devuelve un mapa { teacher_id → candidate_id } para los IDs dados. */
export async function getCandidateMapForTeachers(
  teacherIds: string[],
): Promise<Record<string, string>> {
  if (teacherIds.length === 0) return {}
  const { data } = await supabase
    .from('candidates')
    .select('id, teacher_id')
    .in('teacher_id', teacherIds)
  const map: Record<string, string> = {}
  for (const row of (data ?? []) as { id: string; teacher_id: string }[]) {
    map[row.teacher_id] = row.id
  }
  return map
}

export interface NewTeacherPayload {
  full_name:         string
  dni:               string
  doc_type?:         string | null
  academic_degree?:  string | null
  dedication_regime?: string | null
  labor_condition?:  string | null
  faculty?:          string | null
  main_ep?:          string | null
  campus?:           string | null
  condition?:        string | null
}

export async function createTeacher(payload: NewTeacherPayload): Promise<Teacher> {
  const { data, error } = await supabase
    .from('teachers')
    .insert(payload)
    .select('id, dni, full_name, academic_degree, dedication_regime, faculty, campus, main_ep')
    .single()
  if (error) throw error
  return data as Teacher
}

export async function createCandidateFromTeacher(teacherId: string): Promise<{ id: string; existed: boolean }> {
  const { data: existing } = await supabase
    .from('candidates')
    .select('id')
    .eq('teacher_id', teacherId)
    .maybeSingle()

  if (existing) return { id: (existing as { id: string }).id, existed: true }

  const { data, error } = await supabase
    .from('candidates')
    .insert({ teacher_id: teacherId, status: 'draft' })
    .select('id')
    .single()

  if (error) throw error
  return { id: (data as { id: string }).id, existed: false }
}
