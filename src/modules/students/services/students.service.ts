import { supabase } from '@/core/supabase'

// ── Types ──────────────────────────────────────────────────────────────────

export interface Student {
  id:           string
  dni:          string
  student_code: string | null
  full_name:    string
  program:      string | null
  faculty:      string | null
  campus:       string | null
  cycle:        string | null
  phone:        string | null
  birth_date:   string | null
}

export interface StudentDetail {
  id:                  string
  external_id:         string | null
  student_code:        string | null
  dni:                 string
  full_name:           string
  sex:                 string | null
  institutional_email: string | null
  phone:               string | null
  program:             string | null
  faculty:             string | null
  campus:              string | null
  modality:            string | null
  cycle:               string | null
  group:               string | null
  country:             string | null
  postal_code:         string | null
  birth_date:          string | null
  religion:            string | null
  created_at:          string
}

export interface PaginatedStudents {
  data:  Student[]
  count: number
}

// ── Queries ────────────────────────────────────────────────────────────────

const LIST_FIELDS = 'id, dni, student_code, full_name, program, faculty, campus, cycle, phone, birth_date'

export async function getStudentsPaginated(
  page:     number = 1,
  pageSize: number = 10,
): Promise<PaginatedStudents> {
  const from = (page - 1) * pageSize
  const to   = from + pageSize - 1

  const { data, count, error } = await supabase
    .from('students')
    .select(LIST_FIELDS, { count: 'exact' })
    .neq('program', 'Libre')
    .order('full_name', { ascending: true })
    .range(from, to)

  if (error) throw error
  return { data: (data ?? []) as Student[], count: count ?? 0 }
}

export async function getLibrePaginated(
  page:     number = 1,
  pageSize: number = 10,
): Promise<PaginatedStudents> {
  const from = (page - 1) * pageSize
  const to   = from + pageSize - 1

  const { data, count, error } = await supabase
    .from('students')
    .select(LIST_FIELDS, { count: 'exact' })
    .eq('program', 'Libre')
    .order('full_name', { ascending: true })
    .range(from, to)

  if (error) throw error
  return { data: (data ?? []) as Student[], count: count ?? 0 }
}

export async function searchStudents(params: {
  dni?:  string
  name?: string
  code?: string   // busca por student_code O dni al mismo tiempo
}): Promise<Student[]> {
  if (!params.dni?.trim() && !params.name?.trim() && !params.code?.trim()) return []

  let query = supabase
    .from('students')
    .select(LIST_FIELDS)
    .neq('program', 'Libre')
    .order('full_name', { ascending: true })
    .limit(50)

  if (params.code?.trim()) {
    const val = params.code.trim()
    query = query.or(`student_code.eq.${val},dni.eq.${val}`)
  } else if (params.dni?.trim()) {
    query = query.eq('dni', params.dni.trim())
  } else if (params.name?.trim()) {
    query = query.ilike('full_name', `%${params.name.trim()}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Student[]
}

export async function searchLibre(params: {
  dni?:  string
  name?: string
  code?: string   // busca por student_code O dni al mismo tiempo
}): Promise<Student[]> {
  if (!params.dni?.trim() && !params.name?.trim() && !params.code?.trim()) return []

  let query = supabase
    .from('students')
    .select(LIST_FIELDS)
    .eq('program', 'Libre')
    .order('full_name', { ascending: true })
    .limit(50)

  if (params.code?.trim()) {
    const val = params.code.trim()
    query = query.or(`student_code.eq.${val},dni.eq.${val}`)
  } else if (params.dni?.trim()) {
    query = query.eq('dni', params.dni.trim())
  } else if (params.name?.trim()) {
    query = query.ilike('full_name', `%${params.name.trim()}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Student[]
}

export interface NewStudentPayload {
  full_name:           string
  dni:                 string
  sex?:                string | null
  birth_date?:         string | null
  phone?:              string | null
  institutional_email?: string | null
  program?:            string | null
  faculty?:            string | null
  campus?:             string | null
  cycle?:              string | null
}

export interface CatalogEntry {
  campus:  string
  faculty: string
  program: string
}

export async function getStudentCatalog(): Promise<CatalogEntry[]> {
  const { data, error } = await supabase
    .from('students')
    .select('campus, faculty, program')
    .not('campus', 'is', null)
    .not('faculty', 'is', null)
    .not('program', 'is', null)
    .neq('program', 'Libre')

  if (error) throw error

  // Deduplicar client-side
  const seen = new Set<string>()
  const result: CatalogEntry[] = []
  for (const row of (data ?? []) as CatalogEntry[]) {
    const key = `${row.campus}|${row.faculty}|${row.program}`
    if (!seen.has(key)) {
      seen.add(key)
      result.push(row)
    }
  }
  return result
}

export async function createStudent(payload: NewStudentPayload): Promise<Student> {
  const { data, error } = await supabase
    .from('students')
    .insert(payload)
    .select(LIST_FIELDS)
    .single()
  if (error) throw error
  return data as Student
}

export async function getStudentDetail(id: string): Promise<StudentDetail> {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as StudentDetail
}

/** Devuelve un mapa { student_id → candidate_id } para los IDs dados. */
export async function getCandidateMapForStudents(
  studentIds: string[],
): Promise<Record<string, string>> {
  if (studentIds.length === 0) return {}
  const { data } = await supabase
    .from('candidates')
    .select('id, student_id')
    .in('student_id', studentIds)
  const map: Record<string, string> = {}
  for (const row of (data ?? []) as { id: string; student_id: string }[]) {
    map[row.student_id] = row.id
  }
  return map
}

export interface NewPersonPayload {
  full_name: string
  dni:        string
  sex?:       '1' | '2' | null
  birth_date?: string | null
  phone?:      string | null
  institutional_email?: string | null
}

export async function createPersonAndCandidate(payload: NewPersonPayload): Promise<{ id: string; existed: boolean }> {
  // Verificar si ya existe un estudiante con ese DNI
  const { data: existing } = await supabase
    .from('students')
    .select('id')
    .eq('dni', payload.dni.trim())
    .maybeSingle()

  let studentId: string
  if (existing) {
    studentId = (existing as { id: string }).id
  } else {
    const { data: newStudent, error: insertErr } = await supabase
      .from('students')
      .insert({
        dni:                payload.dni.trim(),
        full_name:          payload.full_name.trim(),
        sex:                payload.sex ?? null,
        birth_date:         payload.birth_date ?? null,
        phone:              payload.phone?.trim() ?? null,
        institutional_email: payload.institutional_email?.trim() ?? null,
        program:            'Libre',
      })
      .select('id')
      .single()
    if (insertErr) throw insertErr
    studentId = (newStudent as { id: string }).id
  }

  // Crear la ficha de candidato
  const { data: existingCandidate } = await supabase
    .from('candidates')
    .select('id')
    .eq('student_id', studentId)
    .maybeSingle()

  if (existingCandidate) return { id: (existingCandidate as { id: string }).id, existed: true }

  const { data, error } = await supabase
    .from('candidates')
    .insert({ student_id: studentId, status: 'draft' })
    .select('id')
    .single()

  if (error) throw error
  return { id: (data as { id: string }).id, existed: false }
}

export async function updateStudentPersonalData(
  studentId: string,
  payload: {
    program?: string | null
    sex?: string | null
    birth_date?: string | null
    country?: string | null
    phone?: string | null
    institutional_email?: string | null
  },
): Promise<void> {
  const { error } = await supabase.from('students').update(payload).eq('id', studentId)
  if (error) throw error
}

export async function createCandidateFromStudent(studentId: string): Promise<{ id: string; existed: boolean }> {
  // Verificar si ya existe una ficha para este estudiante
  const { data: existing } = await supabase
    .from('candidates')
    .select('id')
    .eq('student_id', studentId)
    .maybeSingle()

  if (existing) return { id: (existing as { id: string }).id, existed: true }

  const { data, error } = await supabase
    .from('candidates')
    .insert({ student_id: studentId, status: 'draft' })
    .select('id')
    .single()

  if (error) throw error
  return { id: (data as { id: string }).id, existed: false }
}
