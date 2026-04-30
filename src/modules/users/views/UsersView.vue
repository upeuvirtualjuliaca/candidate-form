<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Tabs, { type Tab } from '@/components/ui/Tabs.vue'
import {
  getUsersList,
  updateUserRole,
  toggleUserActive,
  updateUserProfile,
  updateUserPassword,
  inviteUser,
  deleteUser,
  ROLES,
  PERMISSIONS,
  roleHasPermission,
  type AppUser,
  type UserRole,
} from '../services/users.service'

// ── Tabs ───────────────────────────────────────────────────────────────────
const tabs: Tab[] = [
  { key: 'users',       label: 'Usuarios' },
  { key: 'roles',       label: 'Roles' },
  { key: 'permissions', label: 'Permisos' },
]
const activeTab = ref('users')

// ── Users list ─────────────────────────────────────────────────────────────
const users       = ref<AppUser[]>([])
const loading     = ref(false)
const loadError   = ref('')
const userSearch  = ref('')

const filteredUsers = computed(() => {
  const q = userSearch.value.trim().toLowerCase()
  if (!q) return users.value
  return users.value.filter(u =>
    u.email.toLowerCase().includes(q) ||
    (u.full_name ?? '').toLowerCase().includes(q),
  )
})

function userCountForRole(role: UserRole) {
  return users.value.filter(u => u.role === role).length
}

async function loadUsers() {
  loading.value   = true
  loadError.value = ''
  try {
    users.value = await getUsersList()
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : 'Error al cargar usuarios.'
  } finally {
    loading.value = false
  }
}

onMounted(loadUsers)

// ── Invite modal ───────────────────────────────────────────────────────────
const showInvite    = ref(false)
const invEmail      = ref('')
const invName       = ref('')
const invDni        = ref('')
const invRole       = ref<UserRole>('viewer')
const invSaving     = ref(false)
const invError      = ref('')
const invEmailValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invEmail.value.trim()))
const invDniValid   = computed(() => /^\d{6,12}$/.test(invDni.value.trim()))
const invFormValid  = computed(() => invEmailValid.value && invDniValid.value)

function openInvite() {
  invEmail.value = invName.value = invDni.value = invError.value = ''
  invRole.value  = 'viewer'
  showInvite.value = true
}

async function handleInvite() {
  if (!invEmailValid.value || invSaving.value) return
  invSaving.value = true
  invError.value  = ''
  try {
    const user = await inviteUser({ email: invEmail.value, full_name: invName.value, role: invRole.value, dni: invDni.value })
    users.value.push(user)
    showInvite.value = false
  } catch (err) {
    invError.value = err instanceof Error ? err.message : 'No se pudo crear el usuario.'
  } finally {
    invSaving.value = false
  }
}

// ── Edit modal ─────────────────────────────────────────────────────────────
const showEdit       = ref(false)
const editUser       = ref<AppUser | null>(null)
const editName       = ref('')
const editRole       = ref<UserRole>('viewer')
const editSaving     = ref(false)
const editError      = ref('')
const editChangePass = ref(false)
const editPassMode   = ref<'dni' | 'custom'>('dni')
const editPassDni    = ref('')
const editPassCustom = ref('')
const editPassValid  = computed(() => {
  if (!editChangePass.value) return true
  if (editPassMode.value === 'dni') return /^\d{6,12}$/.test(editPassDni.value.trim())
  return editPassCustom.value.trim().length >= 6
})

function openEdit(user: AppUser) {
  editUser.value    = user
  editName.value    = user.full_name ?? ''
  editRole.value    = user.role
  editError.value   = ''
  editChangePass.value = false
  editPassMode.value   = 'dni'
  editPassDni.value    = ''
  editPassCustom.value = ''
  showEdit.value    = true
}

async function handleEdit() {
  if (!editUser.value || editSaving.value || !editPassValid.value) return
  editSaving.value = true
  editError.value  = ''
  try {
    await updateUserProfile(editUser.value.id, editName.value.trim(), editRole.value)
    if (editChangePass.value) {
      const newPass = editPassMode.value === 'dni'
        ? editPassDni.value.trim()
        : editPassCustom.value.trim()
      await updateUserPassword(editUser.value.id, newPass)
    }
    const u = users.value.find(x => x.id === editUser.value!.id)
    if (u) { u.full_name = editName.value.trim() || null; u.role = editRole.value }
    showEdit.value = false
  } catch (err) {
    editError.value = err instanceof Error ? err.message : 'No se pudo actualizar.'
  } finally {
    editSaving.value = false
  }
}

// ── Delete confirm ─────────────────────────────────────────────────────────
const deleteTarget  = ref<AppUser | null>(null)
const deleteSaving  = ref(false)
const deleteError   = ref('')

function openDelete(user: AppUser) {
  deleteTarget.value = user
  deleteError.value  = ''
}

async function handleDelete() {
  if (!deleteTarget.value || deleteSaving.value) return
  deleteSaving.value = true
  deleteError.value  = ''
  try {
    await deleteUser(deleteTarget.value.id)
    users.value = users.value.filter(u => u.id !== deleteTarget.value!.id)
    deleteTarget.value = null
  } catch (err) {
    deleteError.value = err instanceof Error ? err.message : 'No se pudo eliminar.'
  } finally {
    deleteSaving.value = false
  }
}

// ── Toggle active ──────────────────────────────────────────────────────────
const togglingId = ref<string | null>(null)

async function handleToggleActive(user: AppUser) {
  if (togglingId.value) return
  togglingId.value = user.id
  try {
    await toggleUserActive(user.id, !user.is_active)
    user.is_active = !user.is_active
  } catch { /* silent */ } finally {
    togglingId.value = null
  }
}

// ── Permissions table grouping ─────────────────────────────────────────────
const permModules = computed(() => {
  const modules = new Map<string, typeof PERMISSIONS>()
  for (const p of PERMISSIONS) {
    if (!modules.has(p.module)) modules.set(p.module, [])
    modules.get(p.module)!.push(p)
  }
  return modules
})

// ── Helpers ────────────────────────────────────────────────────────────────
function roleBadgeClass(role: UserRole): string {
  const map: Record<UserRole, string> = {
    admin:     'bg-violet-100 text-violet-700',
    recruiter: 'bg-blue-100 text-blue-700',
    viewer:    'bg-gray-100 text-gray-600',
  }
  return map[role]
}

function roleLabel(role: UserRole): string {
  return ROLES.find(r => r.key === role)?.label ?? role
}

function roleColor(color: string): string {
  const map: Record<string, string> = {
    violet: 'bg-violet-50 border-violet-200 text-violet-700',
    blue:   'bg-blue-50 border-blue-200 text-blue-700',
    gray:   'bg-gray-50 border-gray-200 text-gray-600',
  }
  return map[color] ?? 'bg-gray-50 border-gray-200 text-gray-600'
}

function roleIconBg(color: string): string {
  const map: Record<string, string> = {
    violet: 'bg-violet-100 text-violet-700',
    blue:   'bg-blue-100 text-blue-700',
    gray:   'bg-gray-100 text-gray-500',
  }
  return map[color] ?? 'bg-gray-100 text-gray-500'
}

function initials(user: AppUser): string {
  if (user.full_name) {
    return user.full_name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  }
  return user.email[0]?.toUpperCase() ?? '?'
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso))
}
</script>

<template>
  <div class="space-y-6">
    <!-- Heading -->
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div>
        <h2 class="text-2xl font-bold text-[#04395a]">Usuarios y Accesos</h2>
        <p class="text-sm text-gray-500 mt-0.5">Gestión de usuarios, roles y permisos del sistema.</p>
      </div>
      <span v-if="users.length > 0" class="px-3 py-1.5 bg-[#04395a]/8 rounded-xl text-xs font-semibold text-[#04395a]">
        {{ users.length }} usuario{{ users.length !== 1 ? 's' : '' }}
      </span>
    </div>

    <!-- Card -->
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="px-6 pt-4">
        <Tabs v-model="activeTab" :tabs="tabs" />
      </div>

      <div class="px-6 pb-6">

        <!-- ══════════════════════════════════════════════════════════════
             TAB: USUARIOS
        ══════════════════════════════════════════════════════════════ -->
        <div v-show="activeTab === 'users'" class="mt-4 space-y-4">

          <!-- Toolbar -->
          <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <!-- Search -->
            <div class="relative flex-1 max-w-sm">
              <input
                v-model="userSearch"
                type="text"
                placeholder="Buscar por nombre o correo…"
                class="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition-colors"
              />
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="#9ca3af" class="w-4 h-4 absolute left-3 top-2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </div>
            <!-- Invite -->
            <button
              type="button"
              @click="openInvite"
              class="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#04395a] text-white text-sm font-medium hover:bg-[#068ab8] transition-colors shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Invitar usuario
            </button>
          </div>

          <!-- Error -->
          <div v-if="loadError" class="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="#ef4444" class="w-5 h-5 shrink-0">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            {{ loadError }}
            <button type="button" @click="loadUsers" class="ml-auto text-xs underline underline-offset-2">Reintentar</button>
          </div>

          <!-- Skeleton -->
          <div v-else-if="loading" class="space-y-2">
            <div v-for="i in 4" :key="i" class="h-16 bg-gray-100 rounded-xl animate-pulse" :style="{ opacity: 1 - i * 0.15 }" />
          </div>

          <!-- Empty -->
          <div v-else-if="filteredUsers.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
            <div class="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.3" stroke="#9ca3af" class="w-6 h-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
            </div>
            <p class="text-sm font-medium text-gray-500">
              {{ userSearch ? 'Sin resultados para tu búsqueda' : 'No hay usuarios registrados' }}
            </p>
            <button v-if="!userSearch" type="button" @click="openInvite" class="mt-3 text-xs text-[#068ab8] underline underline-offset-2">Invitar el primer usuario</button>
          </div>

          <!-- Table (desktop) -->
          <template v-else>
            <div class="hidden md:block">
              <!-- Header -->
              <div class="grid grid-cols-[2fr_2.5fr_1.5fr_1fr_1fr_auto] gap-3 px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                <span>Usuario</span><span>Correo</span><span>Rol</span><span>Estado</span><span>Creado</span><span>Acciones</span>
              </div>
              <!-- Rows -->
              <div class="space-y-1.5">
                <div
                  v-for="user in filteredUsers"
                  :key="user.id"
                  class="grid grid-cols-[2fr_2.5fr_1.5fr_1fr_1fr_auto] gap-3 items-center px-4 py-3.5 bg-gray-50 hover:bg-[#04395a]/3 rounded-xl transition-colors"
                >
                  <!-- Avatar + name -->
                  <div class="flex items-center gap-3 min-w-0">
                    <div :class="['w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold', roleBadgeClass(user.role)]">
                      {{ initials(user) }}
                    </div>
                    <span class="text-sm font-medium text-gray-800 truncate">{{ user.full_name ?? '—' }}</span>
                  </div>
                  <!-- Email -->
                  <span class="text-sm text-gray-500 truncate font-mono text-xs">{{ user.email }}</span>
                  <!-- Role badge -->
                  <span :class="['text-xs font-semibold px-2.5 py-1 rounded-lg w-fit', roleBadgeClass(user.role)]">
                    {{ roleLabel(user.role) }}
                  </span>
                  <!-- Active toggle -->
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      :disabled="togglingId === user.id"
                      @click="handleToggleActive(user)"
                      :class="[
                        'relative w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none',
                        user.is_active ? 'bg-emerald-500' : 'bg-gray-300',
                        togglingId === user.id ? 'opacity-50 cursor-not-allowed' : '',
                      ]"
                    >
                      <span :class="['absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200', user.is_active ? 'translate-x-4' : 'translate-x-0']" />
                    </button>
                    <span class="text-xs text-gray-400">{{ user.is_active ? 'Activo' : 'Inactivo' }}</span>
                  </div>
                  <!-- Created -->
                  <span class="text-xs text-gray-400">{{ formatDate(user.created_at) }}</span>
                  <!-- Actions -->
                  <div class="flex items-center gap-1 shrink-0">
                    <button type="button" @click="openEdit(user)" title="Editar" class="p-1.5 rounded-lg text-gray-400 hover:text-[#04395a] hover:bg-white transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-4 h-4">
                        <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                      </svg>
                    </button>
                    <button type="button" @click="openDelete(user)" title="Eliminar" class="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-4 h-4">
                        <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Cards (mobile) -->
            <div class="md:hidden space-y-3">
              <div v-for="user in filteredUsers" :key="user.id" class="bg-gray-50 rounded-xl p-4 space-y-3">
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-center gap-3 min-w-0">
                    <div :class="['w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold', roleBadgeClass(user.role)]">
                      {{ initials(user) }}
                    </div>
                    <div class="min-w-0">
                      <p class="text-sm font-semibold text-gray-800 truncate">{{ user.full_name ?? '—' }}</p>
                      <p class="text-xs text-gray-400 truncate">{{ user.email }}</p>
                    </div>
                  </div>
                  <span :class="['text-xs font-semibold px-2 py-1 rounded-lg shrink-0', roleBadgeClass(user.role)]">{{ roleLabel(user.role) }}</span>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <div class="flex items-center gap-2">
                    <button type="button" :disabled="togglingId === user.id" @click="handleToggleActive(user)" :class="['relative w-9 h-5 rounded-full transition-colors duration-200', user.is_active ? 'bg-emerald-500' : 'bg-gray-300', togglingId === user.id ? 'opacity-50' : '']">
                      <span :class="['absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200', user.is_active ? 'translate-x-4' : 'translate-x-0']" />
                    </button>
                    <span class="text-xs text-gray-400">{{ user.is_active ? 'Activo' : 'Inactivo' }}</span>
                  </div>
                  <div class="flex gap-1">
                    <button type="button" @click="openEdit(user)" class="p-2 rounded-lg text-gray-400 hover:text-[#04395a] hover:bg-white transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg>
                    </button>
                    <button type="button" @click="openDelete(user)" class="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- ══════════════════════════════════════════════════════════════
             TAB: ROLES
        ══════════════════════════════════════════════════════════════ -->
        <div v-show="activeTab === 'roles'" class="mt-4 space-y-4">
          <p class="text-xs text-gray-400">Los roles determinan qué puede hacer cada usuario en el sistema. Están definidos de forma fija y no son editables.</p>

          <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div
              v-for="role in ROLES"
              :key="role.key"
              :class="['border rounded-2xl p-5 space-y-4', roleColor(role.color)]"
            >
              <!-- Header -->
              <div class="flex items-start gap-3">
                <div :class="['w-10 h-10 rounded-xl flex items-center justify-center shrink-0', roleIconBg(role.color)]">
                  <!-- admin icon -->
                  <svg v-if="role.key === 'admin'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-5 h-5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                  </svg>
                  <!-- recruiter icon -->
                  <svg v-else-if="role.key === 'recruiter'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-5 h-5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                  <!-- viewer icon -->
                  <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-5 h-5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <p class="text-sm font-bold">{{ role.label }}</p>
                    <span class="text-xs font-medium opacity-60 bg-current/10 px-2 py-0.5 rounded-full">
                      {{ userCountForRole(role.key) }} usuario{{ userCountForRole(role.key) !== 1 ? 's' : '' }}
                    </span>
                  </div>
                  <p class="text-xs mt-1 opacity-70 leading-relaxed">{{ role.description }}</p>
                </div>
              </div>

              <!-- Permissions list -->
              <div class="space-y-1.5">
                <p class="text-xs font-semibold opacity-50 uppercase tracking-wide">Permisos incluidos</p>
                <div class="space-y-1">
                  <div
                    v-for="perm in PERMISSIONS.filter(p => role.permissions.includes(p.key))"
                    :key="perm.key"
                    class="flex items-center gap-2 text-xs opacity-80"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-3.5 h-3.5 shrink-0">
                      <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    {{ perm.label }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ══════════════════════════════════════════════════════════════
             TAB: PERMISOS
        ══════════════════════════════════════════════════════════════ -->
        <div v-show="activeTab === 'permissions'" class="mt-4 space-y-4">
          <p class="text-xs text-gray-400">Matriz completa de permisos por rol. Las celdas marcadas indican que ese rol tiene acceso a esa función.</p>

          <div class="overflow-x-auto rounded-xl border border-gray-100">
            <table class="w-full text-sm border-collapse">
              <thead>
                <tr class="bg-gray-50 border-b border-gray-100">
                  <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-64">Permiso</th>
                  <th v-for="role in ROLES" :key="role.key" class="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide w-32" :class="role.color === 'violet' ? 'text-violet-600' : role.color === 'blue' ? 'text-blue-600' : 'text-gray-500'">
                    {{ role.label }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <template v-for="[module, perms] in permModules" :key="module">
                  <!-- Module header row -->
                  <tr class="bg-[#04395a]/3 border-b border-gray-100">
                    <td colspan="4" class="px-4 py-2 text-xs font-bold text-[#04395a] uppercase tracking-wider">
                      {{ module }}
                    </td>
                  </tr>
                  <!-- Permission rows -->
                  <tr
                    v-for="perm in perms"
                    :key="perm.key"
                    class="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                  >
                    <td class="px-4 py-3">
                      <p class="text-sm font-medium text-gray-700">{{ perm.label }}</p>
                      <p class="text-xs text-gray-400 mt-0.5">{{ perm.description }}</p>
                    </td>
                    <td v-for="role in ROLES" :key="role.key" class="px-4 py-3 text-center">
                      <span v-if="roleHasPermission(role.key, perm.key)" class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="#16a34a" class="w-3.5 h-3.5">
                          <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      </span>
                      <span v-else class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="#d1d5db" class="w-3.5 h-3.5">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                      </span>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  </div>

  <!-- ══════════════════════════════════════════════════════════════════════
       MODAL: Invitar usuario
  ══════════════════════════════════════════════════════════════════════ -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="showInvite" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="showInvite = false">
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="showInvite = false" />
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-5 border-b border-gray-100">
            <div>
              <h3 class="text-base font-bold text-[#04395a]">Invitar usuario</h3>
              <p class="text-xs text-gray-400 mt-0.5">El usuario recibirá acceso al sistema con el rol asignado.</p>
            </div>
            <button type="button" @click="showInvite = false" class="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <!-- Body -->
          <div class="px-6 py-5 space-y-4">
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1.5">Correo electrónico <span class="text-red-400">*</span></label>
              <input v-model="invEmail" type="email" placeholder="usuario@ejemplo.com" class="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1.5">Nombre completo</label>
              <input v-model="invName" type="text" placeholder="Nombres y apellidos…" class="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1.5">
                N° de DNI <span class="text-red-400">*</span>
                <span class="text-gray-400 font-normal">(se usará como contraseña inicial)</span>
              </label>
              <input
                v-model="invDni"
                type="text"
                inputmode="numeric"
                maxlength="12"
                placeholder="Ej: 12345678"
                :class="[
                  'w-full px-3 py-2.5 text-sm rounded-xl border transition focus:outline-none focus:ring-2 focus:ring-[#04395a]/20',
                  invDni && !invDniValid ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-[#04395a]',
                ]"
              />
              <p v-if="invDni && !invDniValid" class="text-xs text-red-500 mt-1">Ingresa solo dígitos (mínimo 6).</p>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1.5">Rol <span class="text-red-400">*</span></label>
              <div class="grid grid-cols-3 gap-2">
                <button
                  v-for="role in ROLES"
                  :key="role.key"
                  type="button"
                  @click="invRole = role.key"
                  :class="[
                    'py-2.5 rounded-xl text-xs font-semibold border-2 transition-colors text-center',
                    invRole === role.key
                      ? role.color === 'violet' ? 'border-violet-500 bg-violet-50 text-violet-700'
                        : role.color === 'blue' ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-400 bg-gray-50 text-gray-700'
                      : 'border-transparent bg-gray-100 text-gray-500 hover:bg-gray-200',
                  ]"
                >
                  {{ role.label }}
                </button>
              </div>
              <p class="text-xs text-gray-400 mt-2">{{ ROLES.find(r => r.key === invRole)?.description }}</p>
            </div>
            <p v-if="invError" class="text-xs text-red-600 font-medium">{{ invError }}</p>
          </div>
          <!-- Footer -->
          <div class="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
            <button type="button" @click="showInvite = false" class="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">Cancelar</button>
            <button type="button" :disabled="!invFormValid || invSaving" @click="handleInvite" class="px-4 py-2 rounded-xl text-sm font-medium text-white bg-[#04395a] hover:bg-[#068ab8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {{ invSaving ? 'Creando…' : 'Crear usuario' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- ══════════════════════════════════════════════════════════════════════
       MODAL: Editar usuario
  ══════════════════════════════════════════════════════════════════════ -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="showEdit" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="showEdit = false">
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="showEdit = false" />
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
          <div class="flex items-center justify-between px-6 py-5 border-b border-gray-100">
            <div>
              <h3 class="text-base font-bold text-[#04395a]">Editar usuario</h3>
              <p class="text-xs text-gray-400 mt-0.5">{{ editUser?.email }}</p>
            </div>
            <button type="button" @click="showEdit = false" class="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div class="px-6 py-5 space-y-4">
            <!-- Nombre -->
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1.5">Nombre completo</label>
              <input v-model="editName" type="text" placeholder="Nombres y apellidos…" class="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition" />
            </div>
            <!-- Rol -->
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1.5">Rol</label>
              <div class="grid grid-cols-3 gap-2">
                <button
                  v-for="role in ROLES"
                  :key="role.key"
                  type="button"
                  @click="editRole = role.key"
                  :class="[
                    'py-2.5 rounded-xl text-xs font-semibold border-2 transition-colors text-center',
                    editRole === role.key
                      ? role.color === 'violet' ? 'border-violet-500 bg-violet-50 text-violet-700'
                        : role.color === 'blue' ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-400 bg-gray-50 text-gray-700'
                      : 'border-transparent bg-gray-100 text-gray-500 hover:bg-gray-200',
                  ]"
                >
                  {{ role.label }}
                </button>
              </div>
              <p class="text-xs text-gray-400 mt-2">{{ ROLES.find(r => r.key === editRole)?.description }}</p>
            </div>

            <!-- Contraseña -->
            <div class="border border-gray-200 rounded-xl overflow-hidden">
              <!-- Toggle -->
              <button
                type="button"
                @click="editChangePass = !editChangePass"
                class="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span class="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-4 h-4 text-gray-400">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                  Restablecer contraseña
                </span>
                <span :class="['w-8 h-4 rounded-full transition-colors duration-200 relative shrink-0', editChangePass ? 'bg-[#04395a]' : 'bg-gray-300']">
                  <span :class="['absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform duration-200', editChangePass ? 'translate-x-4' : 'translate-x-0.5']" />
                </span>
              </button>

              <!-- Options -->
              <div v-if="editChangePass" class="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                <!-- Mode selector -->
                <div class="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    @click="editPassMode = 'dni'"
                    :class="['py-2 rounded-lg text-xs font-semibold border-2 transition-colors', editPassMode === 'dni' ? 'border-[#04395a] bg-[#04395a]/5 text-[#04395a]' : 'border-transparent bg-gray-100 text-gray-500 hover:bg-gray-200']"
                  >
                    Usar N° de DNI
                  </button>
                  <button
                    type="button"
                    @click="editPassMode = 'custom'"
                    :class="['py-2 rounded-lg text-xs font-semibold border-2 transition-colors', editPassMode === 'custom' ? 'border-[#04395a] bg-[#04395a]/5 text-[#04395a]' : 'border-transparent bg-gray-100 text-gray-500 hover:bg-gray-200']"
                  >
                    Contraseña personalizada
                  </button>
                </div>

                <!-- DNI input -->
                <div v-if="editPassMode === 'dni'">
                  <label class="block text-xs text-gray-500 mb-1.5">N° de DNI <span class="text-red-400">*</span></label>
                  <input
                    v-model="editPassDni"
                    type="text"
                    inputmode="numeric"
                    maxlength="12"
                    placeholder="Ej: 12345678"
                    :class="['w-full px-3 py-2.5 text-sm rounded-xl border transition focus:outline-none focus:ring-2 focus:ring-[#04395a]/20', editPassDni && !/^\d{6,12}$/.test(editPassDni) ? 'border-red-300' : 'border-gray-200 focus:border-[#04395a]']"
                  />
                  <p v-if="editPassDni && !/^\d{6,12}$/.test(editPassDni)" class="text-xs text-red-500 mt-1">Solo dígitos, mínimo 6.</p>
                </div>

                <!-- Custom input -->
                <div v-else>
                  <label class="block text-xs text-gray-500 mb-1.5">Nueva contraseña <span class="text-red-400">*</span></label>
                  <input
                    v-model="editPassCustom"
                    type="text"
                    placeholder="Mínimo 6 caracteres"
                    :class="['w-full px-3 py-2.5 text-sm rounded-xl border transition focus:outline-none focus:ring-2 focus:ring-[#04395a]/20', editPassCustom && editPassCustom.trim().length < 6 ? 'border-red-300' : 'border-gray-200 focus:border-[#04395a]']"
                  />
                  <p v-if="editPassCustom && editPassCustom.trim().length < 6" class="text-xs text-red-500 mt-1">Mínimo 6 caracteres.</p>
                </div>
              </div>
            </div>

            <p v-if="editError" class="text-xs text-red-600 font-medium">{{ editError }}</p>
          </div>
          <div class="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
            <button type="button" @click="showEdit = false" class="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">Cancelar</button>
            <button type="button" :disabled="editSaving || !editPassValid" @click="handleEdit" class="px-4 py-2 rounded-xl text-sm font-medium text-white bg-[#04395a] hover:bg-[#068ab8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {{ editSaving ? 'Guardando…' : 'Guardar cambios' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- ══════════════════════════════════════════════════════════════════════
       MODAL: Confirmar eliminación
  ══════════════════════════════════════════════════════════════════════ -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="deleteTarget" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="deleteTarget = null">
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="deleteTarget = null" />
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
          <div class="px-6 py-6 text-center space-y-3">
            <div class="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="#ef4444" class="w-6 h-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <div>
              <p class="text-base font-bold text-gray-800">¿Eliminar usuario?</p>
              <p class="text-sm text-gray-500 mt-1">Se eliminará <strong>{{ deleteTarget?.full_name ?? deleteTarget?.email }}</strong> del sistema. Esta acción no se puede deshacer.</p>
            </div>
            <p v-if="deleteError" class="text-xs text-red-600 font-medium">{{ deleteError }}</p>
          </div>
          <div class="px-6 pb-6 flex gap-3">
            <button type="button" @click="deleteTarget = null" class="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">Cancelar</button>
            <button type="button" :disabled="deleteSaving" @click="handleDelete" class="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 transition-colors">
              {{ deleteSaving ? 'Eliminando…' : 'Sí, eliminar' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-active .relative,
.modal-leave-active .relative {
  transition: transform 0.2s ease;
}
.modal-enter-from .relative,
.modal-leave-to .relative {
  transform: scale(0.96) translateY(8px);
}
</style>
