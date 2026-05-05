import { createClient } from '@supabase/supabase-js'
import { supabase, supabaseUrl, supabaseAnonKey } from '@/core/supabase'

// ── Types ──────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'recruiter' | 'viewer'

export interface AppUser {
  id:         string
  email:      string
  full_name:  string | null
  role:       UserRole
  is_active:  boolean
  created_at: string
}

export interface RoleDefinition {
  key:         UserRole
  label:       string
  description: string
  color:       string
  permissions: string[]
}

export interface Permission {
  key:         string
  label:       string
  description: string
  module:      string
}

export interface InvitePayload {
  email:     string
  full_name: string
  role:      UserRole
  dni:       string
}

// ── Catalogue (static) ─────────────────────────────────────────────────────

export const PERMISSIONS: Permission[] = [
  // Candidatos
  { key: 'candidates.view',   label: 'Ver candidatos',      description: 'Listar y consultar fichas',         module: 'Candidatos' },
  { key: 'candidates.create', label: 'Crear candidatos',    description: 'Crear nuevas fichas de candidatos', module: 'Candidatos' },
  { key: 'candidates.edit',   label: 'Editar candidatos',   description: 'Modificar fichas existentes',       module: 'Candidatos' },
  // Estudiantes
  { key: 'students.view',   label: 'Ver estudiantes',     description: 'Consultar registros de estudiantes', module: 'Estudiantes' },
  { key: 'students.import', label: 'Importar estudiantes', description: 'Cargar Excel de estudiantes',       module: 'Estudiantes' },
  // Docentes
  { key: 'teachers.view',   label: 'Ver docentes',      description: 'Consultar registros de docentes', module: 'Docentes' },
  { key: 'teachers.import', label: 'Importar docentes', description: 'Cargar Excel de docentes',        module: 'Docentes' },
  // Pastores
  { key: 'pastors.view',   label: 'Ver pastores',      description: 'Consultar registros de pastores', module: 'Pastores' },
  { key: 'pastors.manage', label: 'Gestionar pastores', description: 'Crear y editar registros',        module: 'Pastores' },
  // Secretaría
  { key: 'secretaries.view',   label: 'Ver secretaría',       description: 'Consultar registros de secretaría', module: 'Secretaría' },
  { key: 'secretaries.manage', label: 'Gestionar secretaría',  description: 'Crear y editar registros',          module: 'Secretaría' },
  // Reportes
  { key: 'reports.view',   label: 'Ver reportes',     description: 'Acceder a estadísticas y reportes', module: 'Reportes' },
  { key: 'reports.export', label: 'Exportar reportes', description: 'Descargar datos en Excel/PDF',     module: 'Reportes' },
  // Administración
  { key: 'users.view',      label: 'Ver usuarios',        description: 'Listar usuarios del sistema',             module: 'Administración' },
  { key: 'users.manage',    label: 'Gestionar usuarios',  description: 'Invitar, editar y desactivar usuarios',    module: 'Administración' },
  { key: 'settings.manage', label: 'Configuración',       description: 'Administrar parámetros del sistema',      module: 'Administración' },
]

export const ROLES: RoleDefinition[] = [
  {
    key: 'admin',
    label: 'Administrador',
    description: 'Acceso completo al sistema. Puede gestionar usuarios, roles y toda la configuración.',
    color: 'violet',
    permissions: PERMISSIONS.map(p => p.key),
  },
  {
    key: 'recruiter',
    label: 'Reclutador',
    description: 'Gestiona candidatos y fichas. Puede buscar, registrar y editar candidatos.',
    color: 'blue',
    permissions: [
      'candidates.view', 'candidates.create', 'candidates.edit',
      'students.view', 'teachers.view', 'pastors.view', 'secretaries.view',
      'reports.view',
    ],
  },
  {
    key: 'viewer',
    label: 'Visualizador',
    description: 'Acceso de solo lectura. Consulta información sin poder realizar cambios.',
    color: 'gray',
    permissions: [
      'candidates.view',
      'students.view', 'teachers.view', 'pastors.view', 'secretaries.view',
      'reports.view',
    ],
  },
]

// Helper
export function roleHasPermission(role: UserRole, permKey: string): boolean {
  return ROLES.find(r => r.key === role)?.permissions.includes(permKey) ?? false
}

// ── Queries ────────────────────────────────────────────────────────────────

export async function getUsersList(): Promise<AppUser[]> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, email, full_name, role, is_active, created_at')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as AppUser[]
}

export async function updateUserRole(id: string, role: UserRole): Promise<void> {
  const { data, error } = await supabase
    .from('user_profiles')
    .update({ role })
    .eq('id', id)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('Sin permiso para cambiar el rol. Verifica las políticas RLS.')
}

export async function toggleUserActive(id: string, is_active: boolean): Promise<void> {
  const { data, error } = await supabase
    .from('user_profiles')
    .update({ is_active })
    .eq('id', id)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('Sin permiso para modificar este usuario.')
}

export async function updateUserProfile(id: string, full_name: string, role: UserRole): Promise<void> {
  const { data, error } = await supabase
    .from('user_profiles')
    .update({ full_name, role })
    .eq('id', id)
    .select('id')
  if (error) throw error
  // Si data está vacío, RLS bloqueó la actualización silenciosamente → informar
  if (!data || data.length === 0) {
    throw new Error('Sin permiso para actualizar este perfil. Verifica las políticas RLS de la tabla user_profiles.')
  }
}

export async function updateUserPassword(id: string, password: string): Promise<void> {
  const { error } = await supabase.rpc('update_app_user_password', {
    p_user_id:  id,
    p_password: password,
  })
  if (error) throw new Error(error.message)
}

export async function inviteUser(payload: InvitePayload): Promise<AppUser> {
  // Cliente temporal — no afecta la sesión del admin actual
  const tmp = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false, storageKey: '_tmp_su' },
  })

  const { data: auth, error: signUpError } = await tmp.auth.signUp({
    email:    payload.email.trim().toLowerCase(),
    password: payload.dni.trim(),
    options:  { data: { full_name: payload.full_name.trim() || null, role: payload.role } },
  })

  if (signUpError) {
    const msg = signUpError.message.toLowerCase()
    if (msg.includes('rate limit') || msg.includes('email')) {
      throw new Error(
        'Límite de emails de Supabase superado. ' +
        'Ve al dashboard de Supabase → Authentication → Settings ' +
        'y desactiva "Confirm email" para poder crear usuarios sin restricciones.',
      )
    }
    throw new Error(signUpError.message)
  }
  if (!auth.user) throw new Error('No se pudo crear el usuario.')

  // Confirmar email vía RPC si existe (permite crear usuarios aunque "Confirm email" esté activo)
  try {
    await supabase.rpc('confirm_user_email', { p_user_id: auth.user.id })
  } catch { /* RPC opcional — no bloquear si no existe */ }

  const profilePayload = {
    id:        auth.user.id,
    email:     payload.email.trim().toLowerCase(),
    full_name: payload.full_name.trim() || null,
    role:      payload.role,
    is_active: true,
  }

  // Si signUp devolvió sesión (email confirmation desactivado) usar tmp (el usuario escribe su propio perfil)
  // Si no (email confirmation activo y RPC no existe), intentar con el cliente admin
  const writer = auth.session ? tmp : supabase

  const { data, error } = await writer
    .from('user_profiles')
    .upsert(profilePayload)
    .select('id, email, full_name, role, is_active, created_at')
    .single()

  if (error) {
    // Fallback: si el writer propio no pudo, intentar con admin
    const { data: adminData, error: adminError } = await supabase
      .from('user_profiles')
      .upsert(profilePayload)
      .select('id, email, full_name, role, is_active, created_at')
      .single()
    if (adminError) throw new Error(adminError.message)
    return adminData as AppUser
  }

  return data as AppUser
}

export async function deleteUser(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_app_user', { p_user_id: id })
  if (error) throw new Error(error.message)
}
