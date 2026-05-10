import { supabase } from '@/core/supabase'

// ── Types ──────────────────────────────────────────────────────────────────

export interface Secretary {
  id:             string
  dni:            string
  full_name:      string
  phone:          string | null
  church_name:    string | null
  role:           'principal' | 'asociada'
  is_active:      boolean
  is_historical:  boolean
  signature_data: string | null
  created_at:     string
}

export interface PaginatedSecretaries {
  data:  Secretary[]
  count: number
}

const SECRETARY_SELECT = `id, dni, full_name, phone, church_name, role, is_active, is_historical, signature_data, created_at`

// ── CRUD ───────────────────────────────────────────────────────────────────

export async function getSecretaries(
  page:     number = 1,
  pageSize: number = 10,
): Promise<PaginatedSecretaries> {
  const from = (page - 1) * pageSize
  const to   = from + pageSize - 1

  const { data, count, error } = await supabase
    .from('secretaries')
    .select(SECRETARY_SELECT, { count: 'exact' })
    .order('is_historical', { ascending: true })   // activos primero
    .order('full_name',     { ascending: true })
    .range(from, to)

  if (error) throw error
  return {
    data:  (data ?? []) as Secretary[],
    count: count ?? 0,
  }
}

export async function searchSecretaries(params: {
  dni?:  string
  name?: string
}): Promise<Secretary[]> {
  if (!params.dni?.trim() && !params.name?.trim()) return []

  let query = supabase
    .from('secretaries')
    .select(SECRETARY_SELECT)
    .order('is_historical', { ascending: true })
    .order('full_name',     { ascending: true })
    .limit(50)

  if (params.dni?.trim()) {
    query = query.eq('dni', params.dni.trim())
  } else if (params.name?.trim()) {
    query = query.ilike('full_name', `%${params.name.trim()}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Secretary[]
}

export async function createSecretary(payload: {
  dni:         string
  full_name:   string
  phone:       string
  church_name: string
  role:        'principal' | 'asociada'
}): Promise<Secretary> {
  // Si el nuevo registro es principal, archivar TODAS las principales activas existentes
  if (payload.role === 'principal') {
    const { error: archiveError } = await supabase
      .from('secretaries')
      .update({ is_historical: true, is_active: false })
      .eq('role', 'principal')
      .eq('is_active', true)
    if (archiveError) throw archiveError
  }

  const { data, error } = await supabase
    .from('secretaries')
    .insert({
      dni:          payload.dni.trim(),
      full_name:    payload.full_name.trim(),
      phone:        payload.phone.trim()       || null,
      church_name:  payload.church_name.trim() || null,
      role:         payload.role,
      is_active:    true,
      is_historical: false,
    })
    .select(SECRETARY_SELECT)
    .single()

  if (error) throw error
  return data as Secretary
}

export async function updateSecretary(
  id: string,
  payload: { dni: string; full_name: string; phone: string; church_name: string; role: 'principal' | 'asociada' },
): Promise<Secretary> {
  // Los registros históricos no se pueden editar
  const { data: current } = await supabase
    .from('secretaries').select('is_historical, role').eq('id', id).single()
  if ((current as any)?.is_historical) throw new Error('Los registros históricos no se pueden editar.')

  // Si el rol cambia a principal, archivar todas las principales activas que no sean este registro
  if (payload.role === 'principal') {
    const { error: archiveError } = await supabase
      .from('secretaries')
      .update({ is_historical: true, is_active: false })
      .eq('role', 'principal')
      .eq('is_active', true)
      .neq('id', id)
    if (archiveError) throw archiveError
  }

  const { data, error } = await supabase
    .from('secretaries')
    .update({
      dni:         payload.dni.trim(),
      full_name:   payload.full_name.trim(),
      phone:       payload.phone.trim()       || null,
      church_name: payload.church_name.trim() || null,
      role:        payload.role,
    })
    .eq('id', id)
    .select(SECRETARY_SELECT)
    .single()

  if (error) throw error
  return data as Secretary
}

export async function getPrincipalActiveSecretary(): Promise<Secretary | null> {
  const { data, error } = await supabase
    .from('secretaries')
    .select(SECRETARY_SELECT)
    .eq('role', 'principal')
    .eq('is_active', true)
    .eq('is_historical', false)
    .maybeSingle()
  if (error) throw error
  return (data ?? null) as Secretary | null
}

export async function toggleSecretaryActive(id: string, is_active: boolean): Promise<void> {
  // Los registros históricos no se pueden reactivar
  const { data: current } = await supabase
    .from('secretaries').select('is_historical').eq('id', id).single()
  if ((current as any)?.is_historical) throw new Error('Los registros históricos no se pueden modificar.')

  const { error } = await supabase.from('secretaries').update({ is_active }).eq('id', id)
  if (error) throw error
}

export async function deleteSecretary(id: string): Promise<void> {
  // Los registros históricos no se pueden eliminar
  const { data: current } = await supabase
    .from('secretaries').select('is_historical').eq('id', id).single()
  if ((current as any)?.is_historical) throw new Error('Los registros históricos no se pueden eliminar.')

  const { error } = await supabase.from('secretaries').delete().eq('id', id)
  if (error) throw error
}

export async function saveSecretarySignature(id: string, signature_data: string | null): Promise<Secretary> {
  const { data, error } = await supabase
    .from('secretaries')
    .update({ signature_data })
    .eq('id', id)
    .select(SECRETARY_SELECT)
    .single()

  if (error) throw error
  return data as Secretary
}
