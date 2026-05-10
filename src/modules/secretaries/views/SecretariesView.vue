<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import Tabs, { type Tab } from '@/components/ui/Tabs.vue'
import SignaturePad from '@/components/ui/SignaturePad.vue'
import {
  getSecretaries,
  searchSecretaries,
  createSecretary,
  updateSecretary,
  toggleSecretaryActive,
  deleteSecretary,
  saveSecretarySignature,
  type Secretary,
} from '../services/secretaries.service'

// ── Tabs ───────────────────────────────────────────────────────────────────
const tabs: Tab[] = [
  { key: 'list',   label: 'Listado' },
  { key: 'new',    label: 'Nueva'   },
  { key: 'search', label: 'Buscar'  },
]
const activeTab = ref('list')

function errMsg(err: unknown, fallback: string): string {
  return (err as any)?.message || fallback
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: LISTADO
// ═══════════════════════════════════════════════════════════════════════════

const listRows     = ref<Secretary[]>([])
const listCount    = ref(0)
const listPage     = ref(1)
const listPageSize = ref(10)
const listLoading  = ref(false)
const listError    = ref('')

const listTotalPages = computed(() => Math.max(1, Math.ceil(listCount.value / listPageSize.value)))
const listFrom       = computed(() => (listPage.value - 1) * listPageSize.value + 1)
const listTo         = computed(() => Math.min(listPage.value * listPageSize.value, listCount.value))

async function loadList() {
  listLoading.value = true
  listError.value   = ''
  try {
    const res       = await getSecretaries(listPage.value, listPageSize.value)
    listRows.value  = res.data
    listCount.value = res.count
  } catch (err) {
    listError.value = errMsg(err, 'Error al cargar secretarias.')
  } finally {
    listLoading.value = false
  }
}

watch([listPage, listPageSize], loadList)
onMounted(loadList)

// ── Toggle activo/inactivo ─────────────────────────────────────────────────
const togglingId = ref<string | null>(null)

async function handleToggleActive(sec: Secretary) {
  togglingId.value = sec.id
  try {
    await toggleSecretaryActive(sec.id, !sec.is_active)
    sec.is_active = !sec.is_active
    // sync búsqueda
    const r = searchResults.value.find((s) => s.id === sec.id)
    if (r) r.is_active = sec.is_active
  } finally {
    togglingId.value = null
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: NUEVA
// ═══════════════════════════════════════════════════════════════════════════

const newDni        = ref('')
const newFullName   = ref('')
const newPhone      = ref('')
const newChurchName = ref('')
const newRole       = ref<'principal' | 'asociada'>('asociada')
const newSaving     = ref(false)
const newError      = ref('')
const newSuccess    = ref(false)

function resetNew() {
  newDni.value        = ''
  newFullName.value   = ''
  newPhone.value      = ''
  newChurchName.value = ''
  newRole.value       = 'asociada'
  newError.value      = ''
  newSuccess.value    = false
}

async function handleCreate() {
  newError.value   = ''
  newSuccess.value = false
  if (!newDni.value.trim())      { newError.value = 'El DNI es obligatorio.';            return }
  if (!newFullName.value.trim()) { newError.value = 'El nombre completo es obligatorio.'; return }

  newSaving.value = true
  try {
    const created = await createSecretary({
      dni:         newDni.value,
      full_name:   newFullName.value,
      phone:       newPhone.value,
      church_name: newChurchName.value,
      role:        newRole.value,
    })
    newSuccess.value = true
    resetNew()
    setTimeout(() => { newSuccess.value = false }, 2500)
    // Recargar listado para reflejar archivados automáticamente
    loadList()
  } catch (err) {
    newError.value = errMsg(err, 'Error al crear la secretaria.')
  } finally {
    newSaving.value = false
  }
}

watch(activeTab, (tab) => { if (tab === 'new') resetNew() })

// ═══════════════════════════════════════════════════════════════════════════
// TAB: BUSCAR
// ═══════════════════════════════════════════════════════════════════════════

const searchDni     = ref('')
const searchName    = ref('')
const searchResults = ref<Secretary[]>([])
const searchLoading = ref(false)
const searchError   = ref('')
const searchDone    = ref(false)

let debounceTimer: ReturnType<typeof setTimeout> | null = null

function triggerSearch() {
  if (debounceTimer) clearTimeout(debounceTimer)
  const hasDni  = searchDni.value.trim().length > 0
  const hasName = searchName.value.trim().length >= 2
  if (!hasDni && !hasName) { searchResults.value = []; searchDone.value = false; return }
  debounceTimer = setTimeout(runSearch, 400)
}

async function runSearch() {
  searchLoading.value = true
  searchError.value   = ''
  searchDone.value    = false
  try {
    searchResults.value = await searchSecretaries({
      dni:  searchDni.value.trim()  || undefined,
      name: searchName.value.trim() || undefined,
    })
    searchDone.value = true
  } catch (err) {
    searchError.value = errMsg(err, 'Error en la búsqueda.')
  } finally {
    searchLoading.value = false
  }
}

watch([searchDni, searchName], triggerSearch)

// ═══════════════════════════════════════════════════════════════════════════
// EDIT MODAL
// ═══════════════════════════════════════════════════════════════════════════

const editOpen        = ref(false)
const editSecretaryId = ref('')
const editDni         = ref('')
const editFullName    = ref('')
const editPhone       = ref('')
const editChurchName  = ref('')
const editRole        = ref<'principal' | 'asociada'>('asociada')
const editSaving      = ref(false)
const editError       = ref('')

function openEdit(sec: Secretary) {
  editSecretaryId.value = sec.id
  editDni.value         = sec.dni
  editFullName.value    = sec.full_name
  editPhone.value       = sec.phone       ?? ''
  editChurchName.value  = sec.church_name ?? ''
  editRole.value        = sec.role
  editError.value       = ''
  editOpen.value        = true
}

async function handleUpdate() {
  editError.value = ''
  if (!editDni.value.trim())      { editError.value = 'El DNI es obligatorio.';            return }
  if (!editFullName.value.trim()) { editError.value = 'El nombre completo es obligatorio.'; return }

  editSaving.value = true
  try {
    const updated = await updateSecretary(editSecretaryId.value, {
      dni:         editDni.value,
      full_name:   editFullName.value,
      phone:       editPhone.value,
      church_name: editChurchName.value,
      role:        editRole.value,
    })
    // Actualizar en resultados de búsqueda si aplica
    const idx = searchResults.value.findIndex((s) => s.id === editSecretaryId.value)
    if (idx !== -1) searchResults.value.splice(idx, 1, updated)

    editOpen.value = false
    // Recargar listado completo para reflejar cambios en otros registros (ej. archivados)
    loadList()
  } catch (err) {
    editError.value = errMsg(err, 'Error al actualizar.')
  } finally {
    editSaving.value = false
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DELETE
// ═══════════════════════════════════════════════════════════════════════════

const deleteId       = ref<string | null>(null)
const deleteDeleting = ref(false)

function confirmDelete(id: string) { deleteId.value = id }

async function executeDelete() {
  if (!deleteId.value) return
  deleteDeleting.value = true
  try {
    await deleteSecretary(deleteId.value)
    const removeFrom = (arr: Secretary[]) => {
      const idx = arr.findIndex((s) => s.id === deleteId.value)
      if (idx !== -1) arr.splice(idx, 1)
    }
    removeFrom(listRows.value)
    removeFrom(searchResults.value)
    listCount.value = Math.max(0, listCount.value - 1)
    deleteId.value = null
  } finally {
    deleteDeleting.value = false
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SIGNATURE MODAL
// ═══════════════════════════════════════════════════════════════════════════

const sigOpen      = ref(false)
const sigSecretary = ref<Secretary | null>(null)
const sigData      = ref<string | null>(null)
const sigDirty     = ref(false)   // true cuando el usuario modificó el pad
const sigSaving    = ref(false)
const sigError     = ref('')
const sigSaved     = ref(false)

function openSignature(sec: Secretary) {
  sigSecretary.value = sec
  sigData.value      = sec.signature_data ?? null
  sigDirty.value     = false
  sigError.value     = ''
  sigSaved.value     = false
  sigOpen.value      = true
}

watch(sigData, () => { sigDirty.value = true })

async function handleSaveSignature() {
  if (!sigSecretary.value) return
  sigError.value = ''
  sigSaved.value = false
  sigSaving.value = true
  try {
    const updated = await saveSecretarySignature(sigSecretary.value.id, sigData.value)
    // Sincronizar en listado y búsqueda
    const syncRow = (arr: Secretary[]) => {
      const idx = arr.findIndex((s) => s.id === updated.id)
      if (idx !== -1) arr.splice(idx, 1, updated)
    }
    syncRow(listRows.value)
    syncRow(searchResults.value)
    sigSecretary.value = updated
    sigDirty.value = false
    sigSaved.value = true
    setTimeout(() => { sigSaved.value = false }, 2500)
  } catch (err) {
    sigError.value = (err as any)?.message || 'Error al guardar la firma.'
  } finally {
    sigSaving.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div>
        <h2 class="text-2xl font-bold text-[#04395a]">Secretaría</h2>
        <p class="text-sm text-gray-500 mt-0.5">Gestión de secretarias de iglesia adventista.</p>
      </div>
      <span v-if="listCount > 0" class="px-3 py-1.5 bg-[#04395a]/8 rounded-xl text-xs font-semibold text-[#04395a]">
        {{ listCount.toLocaleString() }} secretaria{{ listCount !== 1 ? 's' : '' }}
      </span>
    </div>

    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="px-6 pt-4">
        <Tabs v-model="activeTab" :tabs="tabs" />
      </div>

      <div class="px-6 pb-6">

        <!-- ════════════════════════════════════════════════════════════════
             TAB: LISTADO
        ════════════════════════════════════════════════════════════════ -->
        <div v-show="activeTab === 'list'" class="mt-4 space-y-4">

          <div v-if="listError" class="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="#ef4444" class="w-5 h-5 shrink-0"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" /></svg>
            <p class="text-sm text-red-700 flex-1">{{ listError }}</p>
            <button type="button" @click="loadList" class="text-xs font-medium text-red-700 underline">Reintentar</button>
          </div>

          <div v-else-if="listLoading" class="space-y-2">
            <div v-for="i in listPageSize" :key="i" class="h-12 bg-gray-100 rounded-xl animate-pulse" :style="{ opacity: 1 - i * 0.06 }" />
          </div>

          <div v-else-if="listRows.length === 0" class="flex flex-col items-center justify-center py-20 text-center">
            <div class="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.3" stroke="#9ca3af" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>
            </div>
            <p class="text-sm font-medium text-gray-500">Sin secretarias registradas</p>
            <p class="text-xs text-gray-400 mt-1">Crea la primera desde la pestaña <button type="button" @click="activeTab = 'new'" class="underline hover:text-[#04395a]">Nueva</button>.</p>
          </div>

          <template v-else>
            <!-- Desktop header -->
            <div class="hidden lg:grid grid-cols-[1fr_2fr_1fr_1.5fr_auto_auto_auto] gap-3 px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
              <span>DNI</span>
              <span>Nombre completo</span>
              <span>Teléfono</span>
              <span>Iglesia</span>
              <span>Tipo</span>
              <span>Estado</span>
              <span>Acciones</span>
            </div>

            <div class="space-y-2">
              <div
                v-for="sec in listRows" :key="sec.id"
                class="group rounded-xl transition-colors duration-150 border"
                :class="sec.is_historical
                  ? 'bg-amber-50/40 border-amber-100 opacity-70'
                  : sec.is_active
                    ? 'bg-gray-50 border-transparent hover:bg-[#04395a]/3'
                    : 'bg-gray-50/50 border-transparent opacity-60 hover:opacity-80'"
              >
                <!-- Desktop row -->
                <div class="hidden lg:grid grid-cols-[1fr_2fr_1fr_1.5fr_auto_auto_auto] gap-3 items-center px-4 py-3.5">
                  <span class="text-sm font-mono text-gray-600">{{ sec.dni }}</span>
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="text-sm font-medium text-gray-800 truncate">{{ sec.full_name }}</span>
                    <!-- Badge histórico -->
                    <span v-if="sec.is_historical" class="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3 h-3"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                      Histórico
                    </span>
                  </div>
                  <span class="text-sm text-gray-500">{{ sec.phone || '—' }}</span>
                  <span class="text-sm text-gray-600 truncate">{{ sec.church_name || '—' }}</span>

                  <!-- Tipo badge -->
                  <span
                    class="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold shrink-0"
                    :class="sec.role === 'principal' ? 'bg-[#04395a]/10 text-[#04395a]' : 'bg-gray-100 text-gray-500'"
                  >
                    {{ sec.role === 'principal' ? 'Principal' : 'Asociada' }}
                  </span>

                  <!-- Toggle activo (bloqueado para históricos) -->
                  <span
                    v-if="sec.is_historical"
                    class="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-400 cursor-default"
                    title="Registro histórico — no modificable"
                  >
                    <span class="w-1.5 h-1.5 rounded-full bg-gray-300" />
                    Inactiva
                  </span>
                  <button
                    v-else
                    type="button"
                    :disabled="togglingId === sec.id"
                    @click="handleToggleActive(sec)"
                    :title="sec.is_active ? 'Deshabilitar' : 'Habilitar'"
                    class="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                    :class="sec.is_active ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'"
                  >
                    <svg v-if="togglingId === sec.id" class="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                    <span v-else class="w-1.5 h-1.5 rounded-full shrink-0" :class="sec.is_active ? 'bg-emerald-500' : 'bg-gray-300'" />
                    {{ sec.is_active ? 'Activa' : 'Inactiva' }}
                  </button>

                  <!-- Acciones (bloqueadas para históricos) -->
                  <div class="flex items-center gap-1 shrink-0">
                    <template v-if="sec.is_historical">
                      <span class="text-xs text-amber-600 italic px-1">Solo lectura</span>
                    </template>
                    <template v-else>
                      <button type="button" @click="openSignature(sec)"
                        class="p-1.5 rounded-lg transition-colors"
                        :class="sec.signature_data ? 'text-emerald-600 hover:bg-emerald-50' : 'text-gray-400 hover:text-[#04395a] hover:bg-white'"
                        :title="sec.signature_data ? 'Ver / editar firma' : 'Agregar firma'">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487 18.55 2.8a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z" /></svg>
                      </button>
                      <button type="button" @click="openEdit(sec)" class="p-1.5 rounded-lg text-amber-600 bg-amber-50 hover:bg-amber-100 transition-colors" title="Editar datos">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>
                      </button>
                      <button type="button" @click="confirmDelete(sec.id)" class="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Eliminar">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                      </button>
                    </template>
                  </div>
                </div>

                <!-- Mobile card -->
                <div class="lg:hidden p-4 space-y-2">
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                      <div class="flex items-center gap-2 flex-wrap">
                        <p class="text-sm font-semibold text-gray-800">{{ sec.full_name }}</p>
                        <span class="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-semibold"
                          :class="sec.role === 'principal' ? 'bg-[#04395a]/10 text-[#04395a]' : 'bg-gray-100 text-gray-500'">
                          {{ sec.role === 'principal' ? 'Principal' : 'Asociada' }}
                        </span>
                        <span v-if="sec.is_historical" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3 h-3"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                          Histórico
                        </span>
                      </div>
                      <p class="text-xs font-mono text-gray-500 mt-0.5">{{ sec.dni }}</p>
                      <p v-if="sec.phone" class="text-xs text-gray-400 mt-0.5">{{ sec.phone }}</p>
                      <p v-if="sec.church_name" class="text-xs text-[#04395a] font-medium mt-0.5">{{ sec.church_name }}</p>
                    </div>
                    <div class="flex flex-col gap-1 items-end shrink-0">
                      <template v-if="!sec.is_historical">
                        <div class="flex gap-1">
                          <button type="button" @click="openSignature(sec)"
                            class="p-1.5 rounded-lg transition-colors"
                            :class="sec.signature_data ? 'text-emerald-600 hover:bg-emerald-50' : 'text-gray-400 hover:text-[#04395a] hover:bg-white'"
                            :title="sec.signature_data ? 'Ver / editar firma' : 'Agregar firma'">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487 18.55 2.8a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z" /></svg>
                          </button>
                          <button type="button" @click="openEdit(sec)" class="p-1.5 rounded-lg text-amber-600 bg-amber-50 hover:bg-amber-100 transition-colors" title="Editar datos">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>
                          </button>
                          <button type="button" @click="confirmDelete(sec.id)" class="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                          </button>
                        </div>
                        <button type="button" :disabled="togglingId === sec.id" @click="handleToggleActive(sec)"
                          class="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors disabled:opacity-50"
                          :class="sec.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'">
                          <span class="w-1.5 h-1.5 rounded-full" :class="sec.is_active ? 'bg-emerald-500' : 'bg-gray-300'" />
                          {{ sec.is_active ? 'Activa' : 'Inactiva' }}
                        </button>
                      </template>
                      <span v-else class="text-[10px] text-amber-600 italic">Solo lectura</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Pagination -->
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-gray-100">
              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-400">Mostrar</span>
                <select v-model="listPageSize" @change="listPage = 1" class="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 bg-white">
                  <option v-for="n in [10, 25, 50]" :key="n" :value="n">{{ n }}</option>
                </select>
                <span class="text-xs text-gray-400">por página</span>
                <span v-if="listCount > 0" class="text-xs text-gray-400">· {{ listFrom }}–{{ listTo }} de {{ listCount }}</span>
              </div>
              <div v-if="listTotalPages > 1" class="flex items-center gap-1">
                <button type="button" :disabled="listPage === 1" @click="listPage--" class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
                </button>
                <template v-for="p in listTotalPages" :key="p">
                  <button v-if="p === 1 || p === listTotalPages || Math.abs(p - listPage) <= 1" type="button" @click="listPage = p" :class="['w-8 h-8 rounded-lg text-xs font-medium transition-colors', p === listPage ? 'bg-[#04395a] text-white' : 'text-gray-600 hover:bg-gray-100']">{{ p }}</button>
                  <span v-else-if="(p === 2 && listPage > 3) || (p === listTotalPages - 1 && listPage < listTotalPages - 2)" class="w-8 h-8 flex items-center justify-center text-gray-300 text-xs">…</span>
                </template>
                <button type="button" :disabled="listPage === listTotalPages" @click="listPage++" class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                </button>
              </div>
            </div>
          </template>
        </div>

        <!-- ════════════════════════════════════════════════════════════════
             TAB: NUEVA
        ════════════════════════════════════════════════════════════════ -->
        <div v-show="activeTab === 'new'" class="mt-4 max-w-2xl space-y-5">

          <div class="grid sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1.5">DNI <span class="text-red-400">*</span></label>
              <input v-model="newDni" type="text" inputmode="numeric" maxlength="12" placeholder="Número de DNI…"
                class="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1.5">Nombre completo <span class="text-red-400">*</span></label>
              <input v-model="newFullName" type="text" placeholder="Apellidos y nombres…"
                class="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1.5">Teléfono</label>
              <input v-model="newPhone" type="tel" inputmode="tel" placeholder="Ej: 987654321…"
                class="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1.5">Nombre de la iglesia</label>
              <input v-model="newChurchName" type="text" placeholder="Iglesia Adventista de…"
                class="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition" />
            </div>
          </div>

          <!-- Tipo -->
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-2">Tipo de secretaria</label>
            <div class="flex gap-3">
              <label
                class="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border cursor-pointer transition-all select-none flex-1"
                :class="newRole === 'principal' ? 'border-[#04395a]/30 bg-[#04395a]/5' : 'border-gray-200 hover:bg-gray-50'"
              >
                <div class="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
                  :class="newRole === 'principal' ? 'border-[#04395a]' : 'border-gray-300'">
                  <div v-if="newRole === 'principal'" class="w-2 h-2 rounded-full bg-[#04395a]" />
                </div>
                <input type="radio" v-model="newRole" value="principal" class="sr-only" />
                <span class="text-sm" :class="newRole === 'principal' ? 'text-[#04395a] font-semibold' : 'text-gray-600'">Principal</span>
              </label>
              <label
                class="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border cursor-pointer transition-all select-none flex-1"
                :class="newRole === 'asociada' ? 'border-[#04395a]/30 bg-[#04395a]/5' : 'border-gray-200 hover:bg-gray-50'"
              >
                <div class="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
                  :class="newRole === 'asociada' ? 'border-[#04395a]' : 'border-gray-300'">
                  <div v-if="newRole === 'asociada'" class="w-2 h-2 rounded-full bg-[#04395a]" />
                </div>
                <input type="radio" v-model="newRole" value="asociada" class="sr-only" />
                <span class="text-sm" :class="newRole === 'asociada' ? 'text-[#04395a] font-semibold' : 'text-gray-600'">Asociada</span>
              </label>
            </div>
          </div>

          <p v-if="newError" class="text-xs text-red-500">{{ newError }}</p>
          <Transition name="fade">
            <p v-if="newSuccess" class="text-xs text-emerald-600 font-medium">Secretaria registrada correctamente.</p>
          </Transition>

          <div class="flex items-center gap-3 pt-2 border-t border-gray-100">
            <button type="button" :disabled="newSaving" @click="handleCreate"
              class="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-[#04395a] hover:bg-[#068ab8] disabled:opacity-50 transition-colors">
              <svg v-if="newSaving" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              {{ newSaving ? 'Guardando…' : 'Registrar secretaria' }}
            </button>
            <button type="button" @click="resetNew" class="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-100 transition-colors">Limpiar</button>
          </div>
        </div>

        <!-- ════════════════════════════════════════════════════════════════
             TAB: BUSCAR
        ════════════════════════════════════════════════════════════════ -->
        <div v-show="activeTab === 'search'" class="mt-4 space-y-4">

          <div class="grid sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1.5">Buscar por DNI</label>
              <div class="relative">
                <input v-model="searchDni" type="text" inputmode="numeric" placeholder="Ej: 12345678" maxlength="12"
                  class="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition"
                  :disabled="!!searchName.trim()" />
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="#9ca3af" class="w-4 h-4 absolute left-3 top-3"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>
              </div>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1.5">Buscar por nombre</label>
              <div class="relative">
                <input v-model="searchName" type="text" placeholder="Mínimo 2 caracteres…"
                  class="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition"
                  :disabled="!!searchDni.trim()" />
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="#9ca3af" class="w-4 h-4 absolute left-3 top-3"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
              </div>
            </div>
          </div>
          <p class="text-xs text-gray-400">Solo un campo activo a la vez. DNI busca coincidencia exacta · Nombre busca de forma parcial.</p>

          <div v-if="searchLoading" class="space-y-2">
            <div v-for="i in 4" :key="i" class="h-12 bg-gray-100 rounded-xl animate-pulse" :style="{ opacity: 1 - i * 0.18 }" />
          </div>
          <div v-else-if="searchError" class="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{{ searchError }}</div>
          <div v-else-if="searchDone" class="space-y-2">
            <div v-if="searchResults.length === 0" class="flex flex-col items-center justify-center py-12 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.3" stroke="#d1d5db" class="w-10 h-10 mb-2"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
              <p class="text-sm font-medium text-gray-500">Sin resultados</p>
            </div>
            <template v-else>
              <p class="text-xs text-gray-400">{{ searchResults.length }} resultado{{ searchResults.length !== 1 ? 's' : '' }}</p>
              <div v-for="sec in searchResults" :key="sec.id"
                class="rounded-xl border transition-colors"
                :class="sec.is_historical
                  ? 'bg-amber-50/40 border-amber-100 opacity-70'
                  : sec.is_active ? 'bg-gray-50 border-transparent hover:bg-[#04395a]/3' : 'bg-gray-50/50 border-transparent opacity-60'"
              >
                <div class="flex items-start gap-4 px-4 py-3.5">
                  <div class="w-9 h-9 rounded-full bg-[#04395a]/10 flex items-center justify-center shrink-0 text-xs font-bold text-[#04395a]">{{ sec.full_name.charAt(0) }}</div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <p class="text-sm font-semibold text-gray-800">{{ sec.full_name }}</p>
                      <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                        :class="sec.role === 'principal' ? 'bg-[#04395a]/10 text-[#04395a]' : 'bg-gray-100 text-gray-500'">
                        {{ sec.role === 'principal' ? 'Principal' : 'Asociada' }}
                      </span>
                      <span v-if="sec.is_historical" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3 h-3"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                        Histórico
                      </span>
                      <span v-else class="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                        :class="sec.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'">
                        {{ sec.is_active ? 'Activa' : 'Inactiva' }}
                      </span>
                    </div>
                    <p class="text-xs font-mono text-gray-400">{{ sec.dni }}</p>
                    <div class="flex flex-wrap gap-3 mt-0.5">
                      <span v-if="sec.phone" class="text-xs text-gray-500">{{ sec.phone }}</span>
                      <span v-if="sec.church_name" class="text-xs font-medium text-[#04395a]">{{ sec.church_name }}</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    <template v-if="sec.is_historical">
                      <span class="text-xs text-amber-600 italic">Solo lectura</span>
                    </template>
                    <template v-else>
                      <button type="button" :disabled="togglingId === sec.id" @click="handleToggleActive(sec)"
                        class="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                        :class="sec.is_active ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100' : 'text-gray-500 bg-gray-100 hover:bg-gray-200'">
                        {{ sec.is_active ? 'Deshabilitar' : 'Habilitar' }}
                      </button>
                      <button type="button" @click="openSignature(sec)"
                        class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                        :class="sec.signature_data ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100' : 'text-[#04395a] bg-[#04395a]/8 hover:bg-[#04395a]/15'">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-3 h-3"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487 18.55 2.8a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z" /></svg>
                        {{ sec.signature_data ? 'Ver firma' : 'Firma' }}
                      </button>
                      <button type="button" @click="openEdit(sec)" class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-3 h-3"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>
                        Editar datos
                      </button>
                      <button type="button" @click="confirmDelete(sec.id)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors">Eliminar</button>
                    </template>
                  </div>
                </div>
              </div>
            </template>
          </div>
          <div v-else class="flex flex-col items-center justify-center py-12 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.2" stroke="#d1d5db" class="w-10 h-10 mb-2"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
            <p class="text-sm text-gray-400">Escribe un DNI o nombre para buscar.</p>
          </div>
        </div>

      </div>
    </div>
  </div>

  <!-- ════════════════════════════════════════════════════════════════════════
       EDIT MODAL
  ════════════════════════════════════════════════════════════════════════ -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="editOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="editOpen = false">
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="editOpen = false" />
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden">

          <div class="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
            <div>
              <h3 class="text-base font-bold text-[#04395a]">Editar secretaria</h3>
              <p class="text-xs text-gray-400 mt-0.5">{{ editFullName || 'Sin nombre' }}</p>
            </div>
            <button type="button" @click="editOpen = false" class="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div class="px-6 py-5 space-y-4">
            <div class="grid sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-medium text-gray-500 mb-1.5">DNI <span class="text-red-400">*</span></label>
                <input v-model="editDni" type="text" inputmode="numeric" maxlength="12" placeholder="Número de DNI…"
                  class="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition" />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-500 mb-1.5">Nombre completo <span class="text-red-400">*</span></label>
                <input v-model="editFullName" type="text" placeholder="Apellidos y nombres…"
                  class="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition" />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-500 mb-1.5">Teléfono</label>
                <input v-model="editPhone" type="tel" inputmode="tel" placeholder="Ej: 987654321…"
                  class="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition" />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-500 mb-1.5">Nombre de la iglesia</label>
                <input v-model="editChurchName" type="text" placeholder="Iglesia Adventista de…"
                  class="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition" />
              </div>
            </div>

            <!-- Tipo -->
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-2">Tipo de secretaria</label>
              <div class="flex gap-3">
                <label class="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border cursor-pointer transition-all select-none flex-1"
                  :class="editRole === 'principal' ? 'border-[#04395a]/30 bg-[#04395a]/5' : 'border-gray-200 hover:bg-gray-50'">
                  <div class="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                    :class="editRole === 'principal' ? 'border-[#04395a]' : 'border-gray-300'">
                    <div v-if="editRole === 'principal'" class="w-2 h-2 rounded-full bg-[#04395a]" />
                  </div>
                  <input type="radio" v-model="editRole" value="principal" class="sr-only" />
                  <span class="text-sm" :class="editRole === 'principal' ? 'text-[#04395a] font-semibold' : 'text-gray-600'">Principal</span>
                </label>
                <label class="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border cursor-pointer transition-all select-none flex-1"
                  :class="editRole === 'asociada' ? 'border-[#04395a]/30 bg-[#04395a]/5' : 'border-gray-200 hover:bg-gray-50'">
                  <div class="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                    :class="editRole === 'asociada' ? 'border-[#04395a]' : 'border-gray-300'">
                    <div v-if="editRole === 'asociada'" class="w-2 h-2 rounded-full bg-[#04395a]" />
                  </div>
                  <input type="radio" v-model="editRole" value="asociada" class="sr-only" />
                  <span class="text-sm" :class="editRole === 'asociada' ? 'text-[#04395a] font-semibold' : 'text-gray-600'">Asociada</span>
                </label>
              </div>
            </div>

            <p v-if="editError" class="text-xs text-red-500">{{ editError }}</p>
          </div>

          <div class="px-6 py-4 border-t border-gray-100 flex justify-end gap-2 shrink-0">
            <button type="button" @click="editOpen = false" class="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">Cancelar</button>
            <button type="button" :disabled="editSaving" @click="handleUpdate"
              class="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium text-white bg-[#04395a] hover:bg-[#068ab8] disabled:opacity-50 transition-colors">
              <svg v-if="editSaving" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
              {{ editSaving ? 'Guardando…' : 'Guardar cambios' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- ════════════════════════════════════════════════════════════════════════
       DELETE CONFIRM
  ════════════════════════════════════════════════════════════════════════ -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="deleteId" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" @click.self="deleteId = null">
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="#ef4444" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
            </div>
            <div>
              <p class="text-sm font-semibold text-gray-800">¿Eliminar secretaria?</p>
              <p class="text-xs text-gray-400 mt-0.5">Esta acción no se puede deshacer.</p>
            </div>
          </div>
          <div class="flex gap-2 pt-1">
            <button type="button" @click="deleteId = null" class="flex-1 py-2 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">Cancelar</button>
            <button type="button" @click="executeDelete" :disabled="deleteDeleting" class="flex-1 py-2 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 disabled:opacity-60 transition-colors">
              {{ deleteDeleting ? 'Eliminando…' : 'Eliminar' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- ════════════════════════════════════════════════════════════════════════
       SIGNATURE MODAL
  ════════════════════════════════════════════════════════════════════════ -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="sigOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="sigOpen = false">
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="sigOpen = false" />
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden">

          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
            <div>
              <h3 class="text-base font-bold text-[#04395a]">Firma de secretaria</h3>
              <p class="text-xs text-gray-400 mt-0.5">{{ sigSecretary?.full_name || '' }}</p>
            </div>
            <button type="button" @click="sigOpen = false" class="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <!-- Body -->
          <div class="px-6 py-5 space-y-4">
            <p class="text-xs text-gray-500">
              Dibuja la firma en el recuadro. Cuando estés conforme presiona
              <strong class="text-[#04395a]">Guardar firma</strong> y luego
              <strong class="text-[#04395a]">Guardar en sistema</strong>.
            </p>

            <SignaturePad v-model="sigData" />

            <p v-if="sigError" class="text-xs text-red-500">{{ sigError }}</p>
            <Transition name="fade">
              <p v-if="sigSaved" class="text-xs text-emerald-600 font-medium flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                Firma guardada correctamente.
              </p>
            </Transition>
          </div>

          <!-- Footer -->
          <div class="px-6 py-4 border-t border-gray-100 flex justify-end gap-2 shrink-0">
            <button type="button" @click="sigOpen = false" class="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">Cerrar</button>
            <button type="button" :disabled="sigSaving || !sigDirty" @click="handleSaveSignature"
              class="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium text-white bg-[#04395a] hover:bg-[#068ab8] disabled:opacity-50 transition-colors">
              <svg v-if="sigSaving" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
              {{ sigSaving ? 'Guardando…' : 'Guardar en sistema' }}
            </button>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-active > *, .modal-leave-active > * { transition: transform 0.2s ease, opacity 0.2s ease; }
.modal-enter-from > *, .modal-leave-to > * { transform: scale(0.96) translateY(8px); opacity: 0; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
