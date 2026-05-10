<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import Tabs, { type Tab } from '@/components/ui/Tabs.vue'
import SignaturePad from '@/components/ui/SignaturePad.vue'
import {
  getPastors,
  searchPastors,
  createPastor,
  updatePastor,
  deletePastor,
  savePastorSignature,
  getFacultiesWithPrograms,
  createFaculty,
  updateFaculty,
  deleteFaculty,
  createProgram,
  updateProgram,
  deleteProgram,
  type Pastor,
  type FacultyWithPrograms,
} from '../services/pastors.service'

// ── Tabs ───────────────────────────────────────────────────────────────────

const tabs: Tab[] = [
  { key: 'list',     label: 'Listado'    },
  { key: 'new',      label: 'Nuevo'      },
  { key: 'search',   label: 'Buscar'     },
  { key: 'catalogs', label: 'Catálogos'  },
]
const activeTab = ref('list')

// ── Faculties / Programs (shared) ─────────────────────────────────────────

const faculties        = ref<FacultyWithPrograms[]>([])
const loadingFaculties = ref(false)

async function loadFaculties(force = false) {
  if (!force && faculties.value.length > 0) return
  loadingFaculties.value = true
  try {
    faculties.value = await getFacultiesWithPrograms()
  } finally {
    loadingFaculties.value = false
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: LISTADO
// ═══════════════════════════════════════════════════════════════════════════

const listRows     = ref<Pastor[]>([])
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
    const res       = await getPastors(listPage.value, listPageSize.value)
    listRows.value  = res.data
    listCount.value = res.count
  } catch (err) {
    listError.value = errMsg(err, 'Error al cargar pastores.')
  } finally {
    listLoading.value = false
  }
}

watch([listPage, listPageSize], loadList)
onMounted(() => { loadList(); loadFaculties() })

// ═══════════════════════════════════════════════════════════════════════════
// TAB: NUEVO
// ═══════════════════════════════════════════════════════════════════════════

const newDni        = ref('')
const newFullName   = ref('')
const newPhone      = ref('')
const newProgramIds = ref<string[]>([])
const newSaving     = ref(false)
const newError      = ref('')
const newSuccess    = ref(false)

function toggleProgram(pid: string) {
  const idx = newProgramIds.value.indexOf(pid)
  if (idx === -1) newProgramIds.value.push(pid)
  else newProgramIds.value.splice(idx, 1)
}

function resetNew() {
  newDni.value        = ''
  newFullName.value   = ''
  newPhone.value      = ''
  newProgramIds.value = []
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
    const created = await createPastor({
      dni:        newDni.value,
      full_name:  newFullName.value,
      phone:      newPhone.value,
      programIds: newProgramIds.value,
    })
    listRows.value.unshift(created)
    listCount.value++
    newSuccess.value = true
    resetNew()
    setTimeout(() => { newSuccess.value = false }, 2500)
  } catch (err) {
    newError.value = errMsg(err, 'Error al crear el pastor.')
  } finally {
    newSaving.value = false
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: BUSCAR
// ═══════════════════════════════════════════════════════════════════════════

const searchDni     = ref('')
const searchName    = ref('')
const searchResults = ref<Pastor[]>([])
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
    searchResults.value = await searchPastors({
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
// TAB: CATÁLOGOS — Facultades y Escuelas profesionales
// ═══════════════════════════════════════════════════════════════════════════

// ── Facultad: crear ────────────────────────────────────────────────────────
const newFacName    = ref('')
const newFacSaving  = ref(false)
const newFacError   = ref('')

async function handleAddFaculty() {
  newFacError.value = ''
  if (!newFacName.value.trim()) { newFacError.value = 'El nombre es obligatorio.'; return }
  newFacSaving.value = true
  try {
    const created = await createFaculty(newFacName.value)
    faculties.value.push({ ...created, programs: [] })
    faculties.value.sort((a, b) => a.name.localeCompare(b.name))
    newFacName.value = ''
  } catch (err) {
    newFacError.value = errMsg(err, 'Error al crear la facultad.')
  } finally {
    newFacSaving.value = false
  }
}

// ── Facultad: editar (inline) ──────────────────────────────────────────────
const editFacId      = ref<string | null>(null)
const editFacName    = ref('')
const editFacSaving  = ref(false)
const editFacError   = ref('')

function startEditFaculty(fac: FacultyWithPrograms) {
  editFacId.value    = fac.id
  editFacName.value  = fac.name
  editFacError.value = ''
}

function cancelEditFaculty() { editFacId.value = null }

async function handleUpdateFaculty() {
  editFacError.value = ''
  if (!editFacName.value.trim()) { editFacError.value = 'El nombre es obligatorio.'; return }
  if (!editFacId.value) return
  editFacSaving.value = true
  try {
    const updated = await updateFaculty(editFacId.value, editFacName.value)
    const fac = faculties.value.find((f) => f.id === updated.id)
    if (fac) fac.name = updated.name
    editFacId.value = null
  } catch (err) {
    editFacError.value = errMsg(err, 'Error al actualizar.')
  } finally {
    editFacSaving.value = false
  }
}

// ── Facultad: eliminar ─────────────────────────────────────────────────────
const deleteFacId       = ref<string | null>(null)
const deleteFacDeleting = ref(false)

async function executeDeleteFaculty() {
  if (!deleteFacId.value) return
  deleteFacDeleting.value = true
  try {
    await deleteFaculty(deleteFacId.value)
    const idx = faculties.value.findIndex((f) => f.id === deleteFacId.value)
    if (idx !== -1) faculties.value.splice(idx, 1)
    deleteFacId.value = null
  } catch (err) {
    // reuse generic delete error slot
    console.error(err)
  } finally {
    deleteFacDeleting.value = false
  }
}

// ── Escuela: crear (inline por facultad) ───────────────────────────────────
const newProgFacId   = ref<string | null>(null)
const newProgName    = ref('')
const newProgSaving  = ref(false)
const newProgError   = ref('')

function startAddProgram(facultyId: string) {
  newProgFacId.value  = facultyId
  newProgName.value   = ''
  newProgError.value  = ''
}

function cancelAddProgram() { newProgFacId.value = null }

async function handleAddProgram() {
  newProgError.value = ''
  if (!newProgName.value.trim()) { newProgError.value = 'El nombre es obligatorio.'; return }
  if (!newProgFacId.value) return
  newProgSaving.value = true
  try {
    const created = await createProgram(newProgName.value, newProgFacId.value)
    const fac = faculties.value.find((f) => f.id === newProgFacId.value)
    if (fac) {
      fac.programs.push({ id: created.id, name: created.name })
      fac.programs.sort((a, b) => a.name.localeCompare(b.name))
    }
    newProgFacId.value = null
  } catch (err) {
    newProgError.value = errMsg(err, 'Error al crear la escuela.')
  } finally {
    newProgSaving.value = false
  }
}

// ── Escuela: editar (inline) ───────────────────────────────────────────────
const editProgId     = ref<string | null>(null)
const editProgName   = ref('')
const editProgSaving = ref(false)
const editProgError  = ref('')

function startEditProgram(prog: { id: string; name: string }) {
  editProgId.value    = prog.id
  editProgName.value  = prog.name
  editProgError.value = ''
}

function cancelEditProgram() { editProgId.value = null }

async function handleUpdateProgram() {
  editProgError.value = ''
  if (!editProgName.value.trim()) { editProgError.value = 'El nombre es obligatorio.'; return }
  if (!editProgId.value) return
  editProgSaving.value = true
  try {
    const updated = await updateProgram(editProgId.value, editProgName.value)
    for (const fac of faculties.value) {
      const prog = fac.programs.find((p) => p.id === updated.id)
      if (prog) { prog.name = updated.name; break }
    }
    editProgId.value = null
  } catch (err) {
    editProgError.value = errMsg(err, 'Error al actualizar.')
  } finally {
    editProgSaving.value = false
  }
}

// ── Escuela: eliminar ──────────────────────────────────────────────────────
const deleteProgId       = ref<string | null>(null)
const deleteProgDeleting = ref(false)

async function executeDeleteProgram() {
  if (!deleteProgId.value) return
  deleteProgDeleting.value = true
  try {
    await deleteProgram(deleteProgId.value)
    for (const fac of faculties.value) {
      const idx = fac.programs.findIndex((p) => p.id === deleteProgId.value)
      if (idx !== -1) { fac.programs.splice(idx, 1); break }
    }
    deleteProgId.value = null
  } catch (err) {
    console.error(err)
  } finally {
    deleteProgDeleting.value = false
  }
}

// ── Error helper ──────────────────────────────────────────────────────────
function errMsg(err: unknown, fallback: string): string {
  return (err as any)?.message || fallback
}

// ── Tab watch ──────────────────────────────────────────────────────────────
watch(activeTab, (tab) => {
  if (tab === 'new')      { loadFaculties(); resetNew() }
  if (tab === 'catalogs') { loadFaculties(true) }
})

// ═══════════════════════════════════════════════════════════════════════════
// SIGNATURE MODAL
// ═══════════════════════════════════════════════════════════════════════════

const sigOpen    = ref(false)
const sigPastor  = ref<Pastor | null>(null)
const sigData    = ref<string | null>(null)
const sigDirty   = ref(false)
const sigSaving  = ref(false)
const sigError   = ref('')
const sigSaved   = ref(false)

function openSignature(pastor: Pastor) {
  sigPastor.value = pastor
  sigData.value   = pastor.signature_data ?? null
  sigDirty.value  = false
  sigError.value  = ''
  sigSaved.value  = false
  sigOpen.value   = true
}

watch(sigData, () => { sigDirty.value = true })

async function handleSaveSignature() {
  if (!sigPastor.value) return
  sigError.value  = ''
  sigSaved.value  = false
  sigSaving.value = true
  try {
    const updated = await savePastorSignature(sigPastor.value.id, sigData.value)
    const syncRow = (arr: Pastor[]) => {
      const idx = arr.findIndex((p) => p.id === updated.id)
      if (idx !== -1) arr.splice(idx, 1, updated)
    }
    syncRow(listRows.value)
    syncRow(searchResults.value)
    sigPastor.value = updated
    sigDirty.value  = false
    sigSaved.value  = true
    setTimeout(() => { sigSaved.value = false }, 2500)
  } catch (err) {
    sigError.value = (err as any)?.message || 'Error al guardar la firma.'
  } finally {
    sigSaving.value = false
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EDIT MODAL (pastor)
// ═══════════════════════════════════════════════════════════════════════════

const editOpen       = ref(false)
const editPastorId   = ref('')
const editDni        = ref('')
const editFullName   = ref('')
const editPhone      = ref('')
const editProgramIds = ref<string[]>([])
const editSaving     = ref(false)
const editError      = ref('')

function openEdit(pastor: Pastor) {
  editPastorId.value   = pastor.id
  editDni.value        = pastor.dni
  editFullName.value   = pastor.full_name
  editPhone.value      = pastor.phone ?? ''
  editProgramIds.value = pastor.programs.map((p) => p.id)
  editError.value      = ''
  editOpen.value       = true
  loadFaculties()
}

function toggleEditProgram(pid: string) {
  const idx = editProgramIds.value.indexOf(pid)
  if (idx === -1) editProgramIds.value.push(pid)
  else editProgramIds.value.splice(idx, 1)
}

async function handleUpdate() {
  editError.value = ''
  if (!editDni.value.trim())      { editError.value = 'El DNI es obligatorio.';            return }
  if (!editFullName.value.trim()) { editError.value = 'El nombre completo es obligatorio.'; return }
  editSaving.value = true
  try {
    const updated = await updatePastor(editPastorId.value, {
      dni:        editDni.value,
      full_name:  editFullName.value,
      phone:      editPhone.value,
      programIds: editProgramIds.value,
    })
    const replaceIn = (arr: Pastor[]) => {
      const idx = arr.findIndex((p) => p.id === editPastorId.value)
      if (idx !== -1) arr.splice(idx, 1, updated)
    }
    replaceIn(listRows.value)
    replaceIn(searchResults.value)
    editOpen.value = false
  } catch (err) {
    editError.value = errMsg(err, 'Error al actualizar.')
  } finally {
    editSaving.value = false
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DELETE (pastor)
// ═══════════════════════════════════════════════════════════════════════════

const deleteId       = ref<string | null>(null)
const deleteDeleting = ref(false)

function confirmDelete(id: string) { deleteId.value = id }

async function executeDelete() {
  if (!deleteId.value) return
  deleteDeleting.value = true
  try {
    await deletePastor(deleteId.value)
    const removeFrom = (arr: Pastor[]) => {
      const idx = arr.findIndex((p) => p.id === deleteId.value)
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
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div>
        <h2 class="text-2xl font-bold text-[#04395a]">Pastores</h2>
        <p class="text-sm text-gray-500 mt-0.5">Gestión de pastores y sus escuelas adscritas.</p>
      </div>
      <span v-if="listCount > 0" class="px-3 py-1.5 bg-[#04395a]/8 rounded-xl text-xs font-semibold text-[#04395a]">
        {{ listCount.toLocaleString() }} pastor{{ listCount !== 1 ? 'es' : '' }}
      </span>
    </div>

    <!-- Card -->
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
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="#ef4444" class="w-5 h-5 shrink-0">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            <p class="text-sm text-red-700 flex-1">{{ listError }}</p>
            <button type="button" @click="loadList" class="text-xs font-medium text-red-700 underline">Reintentar</button>
          </div>

          <div v-else-if="listLoading" class="space-y-2">
            <div v-for="i in listPageSize" :key="i" class="h-12 bg-gray-100 rounded-xl animate-pulse" :style="{ opacity: 1 - i * 0.06 }" />
          </div>

          <div v-else-if="listRows.length === 0" class="flex flex-col items-center justify-center py-20 text-center">
            <div class="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.3" stroke="#9ca3af" class="w-6 h-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
            </div>
            <p class="text-sm font-medium text-gray-500">Sin pastores registrados</p>
            <p class="text-xs text-gray-400 mt-1">Crea el primero desde la pestaña <button type="button" @click="activeTab = 'new'" class="underline hover:text-[#04395a]">Nuevo</button>.</p>
          </div>

          <template v-else>
            <div class="hidden lg:grid grid-cols-[1fr_2fr_1fr_2fr_2fr_auto] gap-3 px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
              <span>DNI</span><span>Nombre completo</span><span>Teléfono</span><span>Escuelas adscritas</span><span>Facultad(es)</span><span>Acciones</span>
            </div>

            <div class="space-y-2">
              <div v-for="pastor in listRows" :key="pastor.id" class="group bg-gray-50 hover:bg-[#04395a]/3 rounded-xl transition-colors duration-150">
                <!-- Desktop -->
                <div class="hidden lg:grid grid-cols-[1fr_2fr_1fr_2fr_2fr_auto] gap-3 items-start px-4 py-3.5">
                  <span class="text-sm font-mono text-gray-600 pt-0.5">{{ pastor.dni }}</span>
                  <span class="text-sm font-medium text-gray-800">{{ pastor.full_name }}</span>
                  <span class="text-sm text-gray-500">{{ pastor.phone || '—' }}</span>
                  <div class="flex flex-wrap gap-1">
                    <span v-for="prog in pastor.programs" :key="prog.id" class="inline-block px-2 py-0.5 text-xs rounded-lg bg-[#04395a]/8 text-[#04395a] font-medium">{{ prog.name }}</span>
                    <span v-if="pastor.programs.length === 0" class="text-sm text-gray-300">—</span>
                  </div>
                  <div class="flex flex-wrap gap-1">
                    <span v-for="fac in [...new Set(pastor.programs.map(p => p.faculty.name))]" :key="fac" class="inline-block px-2 py-0.5 text-xs rounded-lg bg-amber-50 text-amber-700 font-medium">{{ fac }}</span>
                    <span v-if="pastor.programs.length === 0" class="text-sm text-gray-300">—</span>
                  </div>
                  <div class="flex items-center gap-1.5 shrink-0">
                    <button type="button" @click="openSignature(pastor)"
                      class="p-1.5 rounded-lg transition-colors"
                      :class="pastor.signature_data ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' : 'text-gray-400 hover:text-[#04395a] hover:bg-white'"
                      :title="pastor.signature_data ? 'Ver / editar firma' : 'Agregar firma'">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487 18.55 2.8a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z" /></svg>
                    </button>
                    <button type="button" @click="openEdit(pastor)" class="p-1.5 rounded-lg text-amber-600 bg-amber-50 hover:bg-amber-100 transition-colors" title="Editar datos">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>
                    </button>
                    <button type="button" @click="confirmDelete(pastor.id)" class="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Eliminar">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                    </button>
                  </div>
                </div>
                <!-- Mobile -->
                <div class="lg:hidden p-4 space-y-2">
                  <div class="flex items-start justify-between gap-2">
                    <div>
                      <p class="text-sm font-semibold text-gray-800">{{ pastor.full_name }}</p>
                      <p class="text-xs font-mono text-gray-500 mt-0.5">{{ pastor.dni }}</p>
                      <p v-if="pastor.phone" class="text-xs text-gray-400 mt-0.5">{{ pastor.phone }}</p>
                    </div>
                    <div class="flex gap-1 shrink-0">
                      <button type="button" @click="openSignature(pastor)"
                        class="p-1.5 rounded-lg transition-colors"
                        :class="pastor.signature_data ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' : 'text-gray-400 hover:text-[#04395a] hover:bg-white'"
                        :title="pastor.signature_data ? 'Ver / editar firma' : 'Agregar firma'">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487 18.55 2.8a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z" /></svg>
                      </button>
                      <button type="button" @click="openEdit(pastor)" class="p-1.5 rounded-lg text-amber-600 bg-amber-50 hover:bg-amber-100 transition-colors" title="Editar datos">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>
                      </button>
                      <button type="button" @click="confirmDelete(pastor.id)" class="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                      </button>
                    </div>
                  </div>
                  <div class="flex flex-wrap gap-1">
                    <span v-for="prog in pastor.programs" :key="prog.id" class="px-2 py-0.5 text-xs rounded-lg bg-[#04395a]/8 text-[#04395a] font-medium">{{ prog.name }}</span>
                    <span v-if="pastor.programs.length === 0" class="text-xs text-gray-300">Sin escuelas adscritas</span>
                  </div>
                  <div class="flex flex-wrap gap-1">
                    <span v-for="fac in [...new Set(pastor.programs.map(p => p.faculty.name))]" :key="fac" class="px-2 py-0.5 text-xs rounded-lg bg-amber-50 text-amber-700 font-medium">{{ fac }}</span>
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
             TAB: NUEVO
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
          </div>

          <!-- Escuelas adscritas -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="text-xs font-medium text-gray-500">
                Escuelas profesionales adscritas
                <span v-if="newProgramIds.length > 0" class="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#04395a] text-white">{{ newProgramIds.length }}</span>
              </label>
              <button v-if="newProgramIds.length > 0" type="button" @click="newProgramIds = []" class="text-xs text-gray-400 hover:text-red-500 transition-colors">Quitar todo</button>
            </div>

            <div v-if="loadingFaculties" class="space-y-2">
              <div v-for="i in 3" :key="i" class="h-10 bg-gray-100 rounded-xl animate-pulse" :style="{ opacity: 1 - i * 0.2 }" />
            </div>
            <div v-else-if="faculties.length === 0" class="rounded-xl border border-dashed border-gray-200 py-8 text-center">
              <p class="text-sm text-gray-400">No hay facultades ni escuelas registradas.</p>
              <button type="button" @click="activeTab = 'catalogs'" class="mt-2 text-xs text-[#04395a] underline hover:text-[#068ab8]">Ir a Catálogos para agregar</button>
            </div>
            <div v-else class="space-y-3">
              <div v-for="faculty in faculties" :key="faculty.id" class="border border-gray-100 rounded-xl overflow-hidden">
                <div class="px-3 py-2 bg-gray-50 border-b border-gray-100">
                  <p class="text-xs font-semibold text-[#04395a]">{{ faculty.name }}</p>
                </div>
                <div v-if="faculty.programs.length === 0" class="px-3 py-3 text-xs text-gray-400 italic">Sin escuelas registradas en esta facultad.</div>
                <div v-else class="p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <label v-for="prog in faculty.programs" :key="prog.id"
                    class="flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-all select-none"
                    :class="newProgramIds.includes(prog.id) ? 'border-[#04395a]/30 bg-[#04395a]/5' : 'border-gray-100 hover:bg-gray-50'">
                    <div class="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors" :class="newProgramIds.includes(prog.id) ? 'border-[#04395a] bg-[#04395a]' : 'border-gray-300'">
                      <svg v-if="newProgramIds.includes(prog.id)" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="white" class="w-2.5 h-2.5"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                    </div>
                    <input type="checkbox" :value="prog.id" :checked="newProgramIds.includes(prog.id)" @change="toggleProgram(prog.id)" class="sr-only" />
                    <span class="text-sm" :class="newProgramIds.includes(prog.id) ? 'text-[#04395a] font-medium' : 'text-gray-600'">{{ prog.name }}</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <p v-if="newError" class="text-xs text-red-500">{{ newError }}</p>
          <Transition name="fade">
            <p v-if="newSuccess" class="text-xs text-emerald-600 font-medium">Pastor creado correctamente.</p>
          </Transition>

          <div class="flex items-center gap-3 pt-2 border-t border-gray-100">
            <button type="button" :disabled="newSaving" @click="handleCreate"
              class="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-[#04395a] hover:bg-[#068ab8] disabled:opacity-50 transition-colors">
              <svg v-if="newSaving" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              {{ newSaving ? 'Guardando…' : 'Crear pastor' }}
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
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="#9ca3af" class="w-4 h-4 absolute left-3 top-3">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
              </div>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1.5">Buscar por nombre</label>
              <div class="relative">
                <input v-model="searchName" type="text" placeholder="Mínimo 2 caracteres…"
                  class="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition"
                  :disabled="!!searchDni.trim()" />
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="#9ca3af" class="w-4 h-4 absolute left-3 top-3">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
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
              <p class="text-xs text-gray-400 mt-1">Intenta con otro DNI o nombre.</p>
            </div>
            <template v-else>
              <p class="text-xs text-gray-400">{{ searchResults.length }} resultado{{ searchResults.length !== 1 ? 's' : '' }}</p>
              <div v-for="pastor in searchResults" :key="pastor.id" class="bg-gray-50 hover:bg-[#04395a]/3 rounded-xl transition-colors">
                <div class="flex items-start gap-4 px-4 py-3.5">
                  <div class="w-9 h-9 rounded-full bg-[#04395a]/10 flex items-center justify-center shrink-0 text-xs font-bold text-[#04395a]">{{ pastor.full_name.charAt(0) }}</div>
                  <div class="flex-1 min-w-0 space-y-1">
                    <p class="text-sm font-semibold text-gray-800">{{ pastor.full_name }}</p>
                    <p class="text-xs font-mono text-gray-400">{{ pastor.dni }}</p>
                    <div class="flex flex-wrap gap-1 mt-1">
                      <span v-for="prog in pastor.programs" :key="prog.id" class="px-2 py-0.5 text-xs rounded-lg bg-[#04395a]/8 text-[#04395a] font-medium">{{ prog.name }}</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    <button type="button" @click="openSignature(pastor)"
                      class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      :class="pastor.signature_data ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100' : 'text-[#04395a] bg-[#04395a]/8 hover:bg-[#04395a]/15'">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-3 h-3"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487 18.55 2.8a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z" /></svg>
                      {{ pastor.signature_data ? 'Ver firma' : 'Firma' }}
                    </button>
                    <button type="button" @click="openEdit(pastor)" class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-3 h-3"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>
                      Editar datos
                    </button>
                    <button type="button" @click="confirmDelete(pastor.id)" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors">Eliminar</button>
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

        <!-- ════════════════════════════════════════════════════════════════
             TAB: CATÁLOGOS
        ════════════════════════════════════════════════════════════════ -->
        <div v-show="activeTab === 'catalogs'" class="mt-4 space-y-6">

          <!-- Agregar facultad -->
          <div class="bg-gray-50 rounded-xl p-4 space-y-3">
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nueva facultad</p>
            <div class="flex gap-2">
              <input v-model="newFacName" type="text" placeholder="Nombre de la facultad…"
                class="flex-1 px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition"
                @keyup.enter="handleAddFaculty" />
              <button type="button" :disabled="newFacSaving" @click="handleAddFaculty"
                class="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[#04395a] hover:bg-[#068ab8] disabled:opacity-50 transition-colors shrink-0">
                <svg v-if="newFacSaving" class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                Agregar
              </button>
            </div>
            <p v-if="newFacError" class="text-xs text-red-500">{{ newFacError }}</p>
          </div>

          <!-- Listado de facultades + escuelas -->
          <div v-if="loadingFaculties" class="space-y-3">
            <div v-for="i in 3" :key="i" class="h-24 bg-gray-100 rounded-xl animate-pulse" :style="{ opacity: 1 - i * 0.2 }" />
          </div>

          <div v-else-if="faculties.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.2" stroke="#d1d5db" class="w-10 h-10 mb-3">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
            </svg>
            <p class="text-sm font-medium text-gray-500">Sin facultades registradas</p>
            <p class="text-xs text-gray-400 mt-1">Agrega la primera usando el formulario de arriba.</p>
          </div>

          <div v-else class="space-y-4">
            <div v-for="faculty in faculties" :key="faculty.id" class="border border-gray-100 rounded-xl overflow-hidden">

              <!-- Cabecera de facultad -->
              <div class="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
                <!-- Modo edición -->
                <template v-if="editFacId === faculty.id">
                  <input v-model="editFacName" type="text"
                    class="flex-1 px-2.5 py-1.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition"
                    @keyup.enter="handleUpdateFaculty" @keyup.escape="cancelEditFaculty" />
                  <p v-if="editFacError" class="text-xs text-red-500 shrink-0">{{ editFacError }}</p>
                  <button type="button" :disabled="editFacSaving" @click="handleUpdateFaculty"
                    class="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-[#04395a] hover:bg-[#068ab8] disabled:opacity-50 transition-colors shrink-0">
                    {{ editFacSaving ? '…' : 'Guardar' }}
                  </button>
                  <button type="button" @click="cancelEditFaculty" class="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-200 transition-colors shrink-0">Cancelar</button>
                </template>
                <!-- Modo lectura -->
                <template v-else>
                  <p class="text-sm font-semibold text-[#04395a] flex-1">{{ faculty.name }}</p>
                  <span class="text-xs text-gray-400">{{ faculty.programs.length }} escuela{{ faculty.programs.length !== 1 ? 's' : '' }}</span>
                  <button type="button" @click="startEditFaculty(faculty)" class="p-1.5 rounded-lg text-gray-400 hover:text-[#04395a] hover:bg-white transition-colors" title="Editar facultad">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" /></svg>
                  </button>
                  <button type="button" @click="deleteFacId = faculty.id" class="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Eliminar facultad">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                  </button>
                </template>
              </div>

              <!-- Escuelas de esta facultad -->
              <div class="divide-y divide-gray-50">
                <div v-for="prog in faculty.programs" :key="prog.id" class="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50/70 transition-colors">
                  <!-- Modo edición programa -->
                  <template v-if="editProgId === prog.id">
                    <input v-model="editProgName" type="text"
                      class="flex-1 px-2.5 py-1.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition"
                      @keyup.enter="handleUpdateProgram" @keyup.escape="cancelEditProgram" />
                    <p v-if="editProgError" class="text-xs text-red-500 shrink-0">{{ editProgError }}</p>
                    <button type="button" :disabled="editProgSaving" @click="handleUpdateProgram"
                      class="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-[#04395a] hover:bg-[#068ab8] disabled:opacity-50 transition-colors shrink-0">
                      {{ editProgSaving ? '…' : 'Guardar' }}
                    </button>
                    <button type="button" @click="cancelEditProgram" class="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-200 transition-colors shrink-0">Cancelar</button>
                  </template>
                  <!-- Modo lectura programa -->
                  <template v-else>
                    <span class="w-1.5 h-1.5 rounded-full bg-[#04395a]/30 shrink-0" />
                    <span class="flex-1 text-sm text-gray-700">{{ prog.name }}</span>
                    <button type="button" @click="startEditProgram(prog)" class="p-1 rounded-lg text-gray-300 hover:text-[#04395a] hover:bg-gray-100 transition-colors" title="Editar escuela">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" /></svg>
                    </button>
                    <button type="button" @click="deleteProgId = prog.id" class="p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors" title="Eliminar escuela">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                    </button>
                  </template>
                </div>

                <!-- Agregar escuela a esta facultad -->
                <div v-if="newProgFacId === faculty.id" class="flex items-center gap-2 px-4 py-2.5 bg-[#04395a]/3">
                  <input v-model="newProgName" type="text" placeholder="Nombre de la escuela…" autofocus
                    class="flex-1 px-2.5 py-1.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition"
                    @keyup.enter="handleAddProgram" @keyup.escape="cancelAddProgram" />
                  <p v-if="newProgError" class="text-xs text-red-500 shrink-0">{{ newProgError }}</p>
                  <button type="button" :disabled="newProgSaving" @click="handleAddProgram"
                    class="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-[#04395a] hover:bg-[#068ab8] disabled:opacity-50 transition-colors shrink-0">
                    {{ newProgSaving ? '…' : 'Agregar' }}
                  </button>
                  <button type="button" @click="cancelAddProgram" class="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-200 transition-colors shrink-0">Cancelar</button>
                </div>
                <div v-else class="px-4 py-2">
                  <button type="button" @click="startAddProgram(faculty.id)"
                    class="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#04395a] transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                    Agregar escuela
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>

  <!-- ════════════════════════════════════════════════════════════════════════
       EDIT MODAL (pastor)
  ════════════════════════════════════════════════════════════════════════ -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="editOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="editOpen = false">
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="editOpen = false" />
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

          <div class="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
            <div>
              <h3 class="text-base font-bold text-[#04395a]">Editar pastor</h3>
              <p class="text-xs text-gray-400 mt-0.5">{{ editFullName || 'Sin nombre' }}</p>
            </div>
            <button type="button" @click="editOpen = false" class="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div class="flex-1 overflow-y-auto px-6 py-5 space-y-5">
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
            </div>

            <div>
              <div class="flex items-center justify-between mb-2">
                <label class="text-xs font-medium text-gray-500">
                  Escuelas profesionales adscritas
                  <span v-if="editProgramIds.length > 0" class="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#04395a] text-white">{{ editProgramIds.length }}</span>
                </label>
                <button v-if="editProgramIds.length > 0" type="button" @click="editProgramIds = []" class="text-xs text-gray-400 hover:text-red-500 transition-colors">Quitar todo</button>
              </div>
              <div class="space-y-3">
                <div v-for="faculty in faculties" :key="faculty.id" class="border border-gray-100 rounded-xl overflow-hidden">
                  <div class="px-3 py-2 bg-gray-50 border-b border-gray-100">
                    <p class="text-xs font-semibold text-[#04395a]">{{ faculty.name }}</p>
                  </div>
                  <div v-if="faculty.programs.length === 0" class="px-3 py-3 text-xs text-gray-400 italic">Sin escuelas.</div>
                  <div v-else class="p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    <label v-for="prog in faculty.programs" :key="prog.id"
                      class="flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-all select-none"
                      :class="editProgramIds.includes(prog.id) ? 'border-[#04395a]/30 bg-[#04395a]/5' : 'border-gray-100 hover:bg-gray-50'">
                      <div class="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors" :class="editProgramIds.includes(prog.id) ? 'border-[#04395a] bg-[#04395a]' : 'border-gray-300'">
                        <svg v-if="editProgramIds.includes(prog.id)" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="white" class="w-2.5 h-2.5"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                      </div>
                      <input type="checkbox" :value="prog.id" :checked="editProgramIds.includes(prog.id)" @change="toggleEditProgram(prog.id)" class="sr-only" />
                      <span class="text-sm" :class="editProgramIds.includes(prog.id) ? 'text-[#04395a] font-medium' : 'text-gray-600'">{{ prog.name }}</span>
                    </label>
                  </div>
                </div>
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
       DELETE CONFIRM — Pastor
  ════════════════════════════════════════════════════════════════════════ -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="deleteId" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" @click.self="deleteId = null">
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="#ef4444" class="w-5 h-5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <div>
              <p class="text-sm font-semibold text-gray-800">¿Eliminar pastor?</p>
              <p class="text-xs text-gray-400 mt-0.5">Se eliminarán también sus asignaciones de escuelas.</p>
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
       DELETE CONFIRM — Facultad
  ════════════════════════════════════════════════════════════════════════ -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="deleteFacId" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" @click.self="deleteFacId = null">
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="#ef4444" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
            </div>
            <div>
              <p class="text-sm font-semibold text-gray-800">¿Eliminar facultad?</p>
              <p class="text-xs text-gray-400 mt-0.5">Se eliminarán también todas sus escuelas y sus asignaciones a pastores.</p>
            </div>
          </div>
          <div class="flex gap-2 pt-1">
            <button type="button" @click="deleteFacId = null" class="flex-1 py-2 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">Cancelar</button>
            <button type="button" @click="executeDeleteFaculty" :disabled="deleteFacDeleting" class="flex-1 py-2 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 disabled:opacity-60 transition-colors">
              {{ deleteFacDeleting ? 'Eliminando…' : 'Eliminar' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- ════════════════════════════════════════════════════════════════════════
       DELETE CONFIRM — Escuela
  ════════════════════════════════════════════════════════════════════════ -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="deleteProgId" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" @click.self="deleteProgId = null">
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="#ef4444" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
            </div>
            <div>
              <p class="text-sm font-semibold text-gray-800">¿Eliminar escuela profesional?</p>
              <p class="text-xs text-gray-400 mt-0.5">Se eliminará la asignación de esta escuela de todos los pastores.</p>
            </div>
          </div>
          <div class="flex gap-2 pt-1">
            <button type="button" @click="deleteProgId = null" class="flex-1 py-2 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">Cancelar</button>
            <button type="button" @click="executeDeleteProgram" :disabled="deleteProgDeleting" class="flex-1 py-2 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 disabled:opacity-60 transition-colors">
              {{ deleteProgDeleting ? 'Eliminando…' : 'Eliminar' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- ════════════════════════════════════════════════════════════════════════
       SIGNATURE MODAL — Pastor
  ════════════════════════════════════════════════════════════════════════ -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="sigOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="sigOpen = false">
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="sigOpen = false" />
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden">

          <div class="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
            <div>
              <h3 class="text-base font-bold text-[#04395a]">Firma del pastor</h3>
              <p class="text-xs text-gray-400 mt-0.5">{{ sigPastor?.full_name || '' }}</p>
            </div>
            <button type="button" @click="sigOpen = false" class="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
            </button>
          </div>

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
