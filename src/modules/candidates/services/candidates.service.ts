import { supabase } from '@/core/supabase'

// ── Types ──────────────────────────────────────────────────────────────────

export type CandidateStatus = 'draft' | 'completed'

export interface CandidateRow {
  id:                       string
  status:                   CandidateStatus
  observations:             string | null
  created_at:               string
  identification_completed:  boolean
  conversion_completed:      boolean
  faith_completed:           boolean
  ceremony_data_completed:   boolean
  students: {
    id:         string
    dni:        string
    full_name:  string
    program:    string | null
    faculty:    string | null
    campus:     string | null
    birth_date: string | null
  } | null
  teachers: {
    id:         string
    dni:        string
    full_name:  string
    faculty:    string | null
    main_ep:    string | null
    campus:     string | null
    birth_date: string | null
  } | null
  created_by:      string | null
  created_by_name: string | null
}

export interface CandidateDetail {
  id:           string
  student_id:   string | null
  teacher_id:   string | null
  created_by:   string | null
  status:       CandidateStatus
  created_at:   string

  // ── Identificación ──────────────────────────────────────────
  observations:                  string | null  // campo legacy / general
  ceremony_type:                 'baptism' | 'rebaptism' | 'faith_profession'
  address:                       string | null
  education_level:               'none' | 'primary' | 'secondary' | 'higher' | 'other' | null
  education_level_other:         string | null
  marital_status:                'single' | 'divorced' | 'widowed' | 'married' | 'other'
  wedding_date:                  string | null
  has_disability:                boolean
  disability_types:              string[]
  church:                        string | null
  pastor:                        string | null
  baptism_date:                  string | null
  identification_observations:   string | null
  guardian_1_name:               string | null
  guardian_1_document:           string | null
  guardian_2_name:               string | null
  guardian_2_document:           string | null

  // ── Ceremonia ───────────────────────────────────────────────
  ceremony_date:                 string | null
  ceremony_place:                string | null
  officiating_pastor:            string | null
  officiating_pastor_dni:        string | null
  receiving_church:              string | null
  church_city:                   string | null
  administrative_meeting_date:   string | null
  ceremony_notes:                string | null
  ceremony_voto:                 string | null

  // ── Conversión ──────────────────────────────────────────────
  conversion_date:               string | null
  conversion_place:              string | null
  influential_person:            string | null
  spiritual_experience:          string | null
  conversion_observations:       string | null
  biblical_instructor_1:         string | null
  biblical_instructor_2:         string | null
  previous_religion:             string | null
  how_knew_iasd:                 string | null
  how_studied_bible:             string | null
  decisive_factor:               string | null

  // ── Declaración de fe ────────────────────────────────────────
  commitment_checks:             boolean[]
  faith_answers:                 Record<string, boolean | null>
  final_declaration:             string | null
  faith_observations:            string | null
  consent_accepted:              boolean
  signature_data:                string | null
  guardian_signature_data:       string | null

  // ── Progreso ────────────────────────────────────────────────
  identification_completed:      boolean
  conversion_completed:          boolean
  faith_completed:               boolean
  ceremony_completed:            boolean

  students: {
    id:                  string
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
  } | null

  teachers: {
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
    sex:              string | null
    birth_date:       string | null
    country:          string | null
    phone:            string | null
    email:            string | null
  } | null
}

export interface PaginatedCandidates {
  data:  CandidateRow[]
  count: number
}

// ── Form payload (save all sections at once) ───────────────────────────────

export interface CandidateFormPayload {
  // Identificación
  observations?:               string | null
  ceremony_type?:              'baptism' | 'rebaptism' | 'faith_profession'
  address?:                    string | null
  education_level?:            'none' | 'primary' | 'secondary' | 'higher' | 'other' | null
  education_level_other?:      string | null
  marital_status?:             'single' | 'divorced' | 'widowed' | 'married' | 'other'
  wedding_date?:               string | null
  has_disability?:             boolean
  disability_types?:           string[]
  church?:                     string | null
  pastor?:                     string | null
  baptism_date?:               string | null
  identification_observations?: string | null
  guardian_1_name?:             string | null
  guardian_1_document?:         string | null
  guardian_2_name?:             string | null
  guardian_2_document?:         string | null
  // Ceremonia
  ceremony_date?:               string | null
  ceremony_place?:              string | null
  officiating_pastor?:          string | null
  officiating_pastor_dni?:      string | null
  receiving_church?:            string | null
  church_city?:                 string | null
  administrative_meeting_date?: string | null
  ceremony_notes?:              string | null
  ceremony_voto?:               string | null
  // Conversión
  conversion_date?:            string | null
  conversion_place?:           string | null
  influential_person?:         string | null
  spiritual_experience?:       string | null
  conversion_observations?:    string | null
  biblical_instructor_1?:      string | null
  biblical_instructor_2?:      string | null
  previous_religion?:          string | null
  how_knew_iasd?:              string | null
  how_studied_bible?:          string | null
  decisive_factor?:            string | null
  // Declaración de fe
  commitment_checks?:          boolean[]
  faith_answers?:              Record<string, boolean | null>
  final_declaration?:          string | null
  faith_observations?:         string | null
  consent_accepted?:           boolean
  signature_data?:             string | null
  guardian_signature_data?:    string | null
}

export interface CompletionResult {
  identification_completed: boolean
  conversion_completed:     boolean
  faith_completed:          boolean
  ceremony_completed:       boolean
  ceremony_data_completed:  boolean
  status:                   CandidateStatus
}

// ── Candidate CRUD ─────────────────────────────────────────────────────────

const CANDIDATE_LIST_SELECT = `
  id, status, observations, created_at, created_by, created_by_name,
  identification_completed, conversion_completed, faith_completed, ceremony_data_completed,
  students ( id, dni, full_name, program, faculty, campus, birth_date ),
  teachers ( id, dni, full_name, faculty, main_ep, campus, birth_date )
`

export async function getCandidates(
  page:       number = 1,
  pageSize:   number = 10,
  status?:    CandidateStatus,
  search?:    string,
  campaignId?: string | null,
): Promise<PaginatedCandidates> {
  const from = (page - 1) * pageSize
  const to   = from + pageSize - 1

  let query = supabase
    .from('candidates')
    .select(CANDIDATE_LIST_SELECT, { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (campaignId) query = query.eq('campaign_id', campaignId)

  if (search?.trim()) {
    const term = `%${search.trim()}%`

    const [{ data: studentMatches }, { data: teacherMatches }] = await Promise.all([
      supabase.from('students').select('id').or(`full_name.ilike.${term},dni.ilike.${term},student_code.ilike.${term}`),
      supabase.from('teachers').select('id').or(`full_name.ilike.${term},dni.ilike.${term}`),
    ])

    const studentIds = (studentMatches ?? []).map((s: { id: string }) => s.id)
    const teacherIds = (teacherMatches ?? []).map((t: { id: string }) => t.id)

    if (studentIds.length === 0 && teacherIds.length === 0) {
      return { data: [], count: 0 }
    }

    const orParts: string[] = []
    if (studentIds.length > 0) orParts.push(`student_id.in.(${studentIds.join(',')})`)
    if (teacherIds.length > 0) orParts.push(`teacher_id.in.(${teacherIds.join(',')})`)
    query = query.or(orParts.join(','))
  }

  query = query.range(from, to)

  const { data, count, error } = await query
  if (error) throw error
  return { data: (data ?? []) as unknown as CandidateRow[], count: count ?? 0 }
}

export async function getCandidateDetail(id: string): Promise<CandidateDetail> {
  const { data, error } = await supabase
    .from('candidates')
    .select(`
      id, student_id, teacher_id, created_by, status, created_at,
      observations, ceremony_type, address, education_level, education_level_other,
      marital_status, wedding_date, has_disability, disability_types,
      church, pastor, baptism_date, identification_observations,
      guardian_1_name, guardian_1_document, guardian_2_name, guardian_2_document,
      ceremony_date, ceremony_place, officiating_pastor, officiating_pastor_dni,
      receiving_church, church_city, administrative_meeting_date, ceremony_notes, ceremony_voto,
      conversion_date, conversion_place, influential_person, spiritual_experience, conversion_observations,
      biblical_instructor_1, biblical_instructor_2, previous_religion,
      how_knew_iasd, how_studied_bible, decisive_factor,
      commitment_checks, faith_answers, final_declaration, faith_observations, consent_accepted, signature_data, guardian_signature_data,
      identification_completed, conversion_completed, faith_completed, ceremony_completed,
      students (
        id, dni, full_name, sex, institutional_email, phone,
        program, faculty, campus, modality, cycle, "group", country, postal_code, birth_date, religion
      ),
      teachers (
        id, dni, full_name, doc_type, academic_degree, dedication_regime,
        labor_condition, campus, faculty, main_ep, condition,
        sex, birth_date, country, phone, email
      )
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  const row = data as unknown as CandidateDetail & { deleted_at?: string | null }
  if (row.deleted_at) throw new Error('CANDIDATE_DELETED')
  return row as CandidateDetail
}

export async function getCandidateIdByStudentId(studentId: string): Promise<string | null> {
  const { data } = await supabase
    .from('candidates')
    .select('id')
    .eq('student_id', studentId)
    .is('deleted_at', null)
    .maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

export async function createCandidate(studentId: string, createdByName?: string | null): Promise<string> {
  const existing = await getCandidateIdByStudentId(studentId)
  if (existing) throw Object.assign(new Error('DUPLICATE'), { candidateId: existing })

  let createdById: string | null = null
  try {
    const { data: { user } } = await supabase.auth.getUser()
    createdById = user?.id ?? null
  } catch { /* ignorar */ }

  const { data, error } = await supabase
    .from('candidates')
    .insert({
      student_id:      studentId,
      status:          'draft',
      created_by:      createdById,
      created_by_name: createdByName ?? null,
    })
    .select('id')
    .single()

  if (error) throw error
  return (data as { id: string }).id
}

// Saves the full form state and recomputes completion flags + status
export async function saveCandidateForm(
  id:      string,
  payload: CandidateFormPayload,
  isMinor: boolean = false,
): Promise<CompletionResult> {
  const baseIdentification = !!(
    payload.address?.trim() &&
    payload.education_level
  )
  const guardianComplete = !!(
    payload.guardian_1_name?.trim() &&
    payload.guardian_1_document?.trim() &&
    payload.guardian_signature_data?.trim()
  )
  // Para menores: solo se exige que el responsable esté completo (nombre + doc + firma).
  // Para mayores: lógica base sin cambios.
  const identification_completed = isMinor ? guardianComplete : baseIdentification
  const conversion_completed = !!(
    payload.biblical_instructor_1?.trim() &&
    payload.how_knew_iasd?.trim()
  )
  const faith_completed = !!(
    payload.consent_accepted &&
    payload.faith_answers &&
    Object.values(payload.faith_answers).some(v => v !== null) &&
    payload.signature_data?.trim()
  )
  // ceremony_data_completed: tab Ceremonia tiene los campos mínimos llenos
  // (distinto de ceremony_completed que marca el bautismo físico en validación)
  const ceremony_data_completed = !!(
    payload.officiating_pastor?.trim() &&
    payload.ceremony_date?.trim()
  )

  const status: CandidateStatus =
    identification_completed && conversion_completed && faith_completed && ceremony_data_completed
      ? 'completed'
      : 'draft'

  const { error } = await supabase.from('candidates').update({
    ...payload,
    identification_completed,
    conversion_completed,
    faith_completed,
    ceremony_data_completed,
    status,
  }).eq('id', id)

  if (error) throw error
  return { identification_completed, conversion_completed, faith_completed, ceremony_completed: ceremony_data_completed, ceremony_data_completed, status }
}

export async function deleteCandidate(id: string): Promise<void> {
  const { error } = await supabase
    .from('candidates')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ── Legacy helpers (kept for compatibility) ────────────────────────────────

export async function updateCandidate(
  id:      string,
  payload: { observations?: string | null; status?: CandidateStatus },
): Promise<void> {
  const { error } = await supabase.from('candidates').update(payload).eq('id', id)
  if (error) throw error
}
