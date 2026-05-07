import { supabase } from '@/core/supabase'

// ── Types ──────────────────────────────────────────────────────────────────

export interface Faculty {
  id:   string
  name: string
}

export interface Program {
  id:      string
  name:    string
  faculty: Faculty
}

export interface Pastor {
  id:        string
  dni:       string
  full_name: string
  phone:     string | null
  created_at: string
  programs:  Program[]
}

export interface PaginatedPastors {
  data:  Pastor[]
  count: number
}

// ── Internal Supabase response helpers ─────────────────────────────────────

type RawPastor = {
  id:        string
  dni:       string
  full_name: string
  phone:     string | null
  created_at: string
  pastor_programs: {
    programs: {
      id:       string
      name:     string
      faculties: { id: string; name: string }
    }
  }[]
}

function mapPastor(raw: RawPastor): Pastor {
  return {
    id:        raw.id,
    dni:       raw.dni,
    full_name: raw.full_name,
    phone:     raw.phone ?? null,
    created_at: raw.created_at,
    programs: (raw.pastor_programs ?? []).map((pp) => ({
      id:      pp.programs.id,
      name:    pp.programs.name,
      faculty: {
        id:   pp.programs.faculties.id,
        name: pp.programs.faculties.name,
      },
    })),
  }
}

const PASTOR_SELECT = `
  id, dni, full_name, phone, created_at,
  pastor_programs (
    programs (
      id, name,
      faculties ( id, name )
    )
  )
`

// ── Pastores CRUD ──────────────────────────────────────────────────────────

export async function getPastors(
  page:     number = 1,
  pageSize: number = 10,
): Promise<PaginatedPastors> {
  const from = (page - 1) * pageSize
  const to   = from + pageSize - 1

  const { data, count, error } = await supabase
    .from('pastors')
    .select(PASTOR_SELECT, { count: 'exact' })
    .order('full_name', { ascending: true })
    .range(from, to)

  if (error) throw error
  return {
    data:  ((data ?? []) as unknown as RawPastor[]).map(mapPastor),
    count: count ?? 0,
  }
}

export async function searchPastors(params: {
  dni?:  string
  name?: string
}): Promise<Pastor[]> {
  if (!params.dni?.trim() && !params.name?.trim()) return []

  let query = supabase
    .from('pastors')
    .select(PASTOR_SELECT)
    .order('full_name', { ascending: true })
    .limit(50)

  if (params.dni?.trim()) {
    query = query.eq('dni', params.dni.trim())
  } else if (params.name?.trim()) {
    query = query.ilike('full_name', `%${params.name.trim()}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return ((data ?? []) as unknown as RawPastor[]).map(mapPastor)
}

// Busca el pastor asignado a una escuela profesional por nombre (flexible, case-insensitive).
// Retorna { full_name, dni } o null si no hay pastor vinculado.
export async function getPastorByProgramName(
  programName: string,
): Promise<{ full_name: string; dni: string } | null> {
  if (!programName?.trim()) return null

  // 1. Buscar el program_id — primero match exacto, si no hay, buscar por contenido
  let prog: { id: string } | null = null

  const { data: exact } = await supabase
    .from('programs')
    .select('id')
    .ilike('name', programName.trim())
    .maybeSingle()

  if (exact) {
    prog = exact as { id: string }
  } else {
    // Buscar por contenido (ej: "EP Ingeniería Civil" contiene "Ingeniería Civil")
    const { data: fuzzy } = await supabase
      .from('programs')
      .select('id')
      .ilike('name', `%${programName.trim()}%`)
      .limit(1)
    prog = ((fuzzy ?? []) as { id: string }[])[0] ?? null
  }

  if (!prog) return null

  // 2. Buscar el pastor vinculado a ese program_id (puede haber más de uno, tomamos el primero)
  const { data: links, error: linkError } = await supabase
    .from('pastor_programs')
    .select('pastor_id')
    .eq('program_id', (prog as { id: string }).id)
    .limit(1)

  if (linkError || !links || links.length === 0) return null
  const link = (links as { pastor_id: string }[])[0]!

  // 3. Obtener nombre y DNI del pastor
  const { data: pastor, error: pastorError } = await supabase
    .from('pastors')
    .select('full_name, dni')
    .eq('id', (link as { pastor_id: string }).pastor_id)
    .maybeSingle()

  if (pastorError || !pastor) return null

  const p = pastor as { full_name: string; dni: string }
  return { full_name: p.full_name, dni: p.dni }
}

export async function getPastorDetail(id: string): Promise<Pastor> {
  const { data, error } = await supabase
    .from('pastors')
    .select(PASTOR_SELECT)
    .eq('id', id)
    .single()

  if (error) throw error
  return mapPastor(data as unknown as RawPastor)
}

export async function createPastor(payload: {
  dni:        string
  full_name:  string
  phone:      string
  programIds: string[]
}): Promise<Pastor> {
  // 1. Insert pastor
  const { data: inserted, error: insertError } = await supabase
    .from('pastors')
    .insert({ dni: payload.dni.trim(), full_name: payload.full_name.trim(), phone: payload.phone.trim() || null })
    .select('id')
    .single()

  if (insertError) throw insertError
  const pastorId = (inserted as { id: string }).id

  // 2. Link programs
  if (payload.programIds.length > 0) {
    const { error: linkError } = await supabase
      .from('pastor_programs')
      .insert(payload.programIds.map((pid) => ({ pastor_id: pastorId, program_id: pid })))
    if (linkError) throw linkError
  }

  return getPastorDetail(pastorId)
}

export async function updatePastor(
  id: string,
  payload: { dni: string; full_name: string; phone: string; programIds: string[] },
): Promise<Pastor> {
  // 1. Update core fields
  const { error: updateError } = await supabase
    .from('pastors')
    .update({ dni: payload.dni.trim(), full_name: payload.full_name.trim(), phone: payload.phone.trim() || null })
    .eq('id', id)

  if (updateError) throw updateError

  // 2. Replace all program links
  const { error: deleteError } = await supabase
    .from('pastor_programs')
    .delete()
    .eq('pastor_id', id)

  if (deleteError) throw deleteError

  if (payload.programIds.length > 0) {
    const { error: linkError } = await supabase
      .from('pastor_programs')
      .insert(payload.programIds.map((pid) => ({ pastor_id: id, program_id: pid })))
    if (linkError) throw linkError
  }

  return getPastorDetail(id)
}

export async function deletePastor(id: string): Promise<void> {
  const { error } = await supabase.from('pastors').delete().eq('id', id)
  if (error) throw error
}

// ── Faculties & Programs (para el selector y catálogos) ───────────────────

export interface FacultyWithPrograms extends Faculty {
  programs: { id: string; name: string }[]
}

export async function getFacultiesWithPrograms(): Promise<FacultyWithPrograms[]> {
  const { data, error } = await supabase
    .from('faculties')
    .select('id, name, programs ( id, name )')
    .order('name', { ascending: true })

  if (error) throw error

  return ((data ?? []) as unknown as {
    id: string
    name: string
    programs: { id: string; name: string }[]
  }[]).map((f) => ({
    id:       f.id,
    name:     f.name,
    programs: (f.programs ?? []).sort((a, b) => a.name.localeCompare(b.name)),
  }))
}

// ── Facultad CRUD ──────────────────────────────────────────────────────────

export async function createFaculty(name: string): Promise<Faculty> {
  const { data, error } = await supabase
    .from('faculties')
    .insert({ name: name.trim() })
    .select('id, name')
    .single()
  if (error) throw error
  return data as Faculty
}

export async function updateFaculty(id: string, name: string): Promise<Faculty> {
  const { data, error } = await supabase
    .from('faculties')
    .update({ name: name.trim() })
    .eq('id', id)
    .select('id, name')
    .single()
  if (error) throw error
  return data as Faculty
}

export async function deleteFaculty(id: string): Promise<void> {
  const { error } = await supabase.from('faculties').delete().eq('id', id)
  if (error) throw error
}

// ── Escuela profesional CRUD ───────────────────────────────────────────────

export async function createProgram(
  name: string,
  facultyId: string,
): Promise<{ id: string; name: string; faculty_id: string }> {
  const { data, error } = await supabase
    .from('programs')
    .insert({ name: name.trim(), faculty_id: facultyId })
    .select('id, name, faculty_id')
    .single()
  if (error) throw error
  return data as { id: string; name: string; faculty_id: string }
}

export async function updateProgram(
  id: string,
  name: string,
): Promise<{ id: string; name: string }> {
  const { data, error } = await supabase
    .from('programs')
    .update({ name: name.trim() })
    .eq('id', id)
    .select('id, name')
    .single()
  if (error) throw error
  return data as { id: string; name: string }
}

export async function deleteProgram(id: string): Promise<void> {
  const { error } = await supabase.from('programs').delete().eq('id', id)
  if (error) throw error
}
