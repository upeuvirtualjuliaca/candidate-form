<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import Tabs from '@/components/ui/Tabs.vue'
import {
  getCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  setActiveCampaign,
  type Campaign,
} from '../services/campaigns.service'

// ── Tabs ───────────────────────────────────────────────────────────────────
const tabs = [
  { key: 'list', label: 'Listado' },
  { key: 'new',  label: 'Nueva'   },
]
const activeTab = ref('list')

// ── Shared helpers ─────────────────────────────────────────────────────────
function errMsg(err: unknown, fallback: string): string {
  return (err as any)?.message || fallback
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}

// ── Campaign status label ──────────────────────────────────────────────────
function campaignStatus(c: Campaign): { label: string; classes: string } {
  if (!c.is_active) {
    return { label: 'Inactiva', classes: 'bg-gray-100 text-gray-500' }
  }
  const t = todayIso()
  if (t < c.start_date) return { label: 'Pendiente', classes: 'bg-blue-100 text-blue-700' }
  if (t > c.end_date)   return { label: 'Vencida',   classes: 'bg-red-100 text-red-700' }
  return { label: 'Vigente', classes: 'bg-green-100 text-green-700' }
}

// ── Listado ────────────────────────────────────────────────────────────────
const listRows     = ref<Campaign[]>([])
const listCount    = ref(0)
const listPage     = ref(1)
const listPageSize = ref(10)
const listLoading  = ref(false)
const listError    = ref('')

const listTotalPages = computed(() =>
  Math.max(1, Math.ceil(listCount.value / listPageSize.value)),
)
const listFrom = computed(() =>
  listCount.value === 0 ? 0 : (listPage.value - 1) * listPageSize.value + 1,
)
const listTo = computed(() =>
  Math.min(listPage.value * listPageSize.value, listCount.value),
)

async function loadList() {
  listLoading.value = true
  listError.value   = ''
  try {
    const result    = await getCampaigns(listPage.value, listPageSize.value)
    listRows.value  = result.data
    listCount.value = result.count
  } catch (err) {
    listError.value = errMsg(err, 'Error al cargar las campañas.')
  } finally {
    listLoading.value = false
  }
}

watch([listPage, listPageSize], loadList)

// ── Set active ─────────────────────────────────────────────────────────────
const activatingId  = ref<string | null>(null)
const activateError = ref('')

async function handleSetActive(c: Campaign) {
  if (c.is_active) return
  activatingId.value  = c.id
  activateError.value = ''
  try {
    await setActiveCampaign(c.id)
    await loadList()
  } catch (err) {
    activateError.value = errMsg(err, 'Error al activar la campaña.')
  } finally {
    activatingId.value = null
  }
}

// ── Nueva campaña ──────────────────────────────────────────────────────────
const newName      = ref('')
const newStartDate = ref('')
const newEndDate   = ref('')
const newSaving    = ref(false)
const newError     = ref('')
const newSuccess   = ref(false)

function resetNewForm() {
  newName.value      = ''
  newStartDate.value = ''
  newEndDate.value   = ''
  newError.value     = ''
}

async function handleCreate() {
  newError.value = ''
  if (!newName.value.trim()) {
    newError.value = 'El nombre de la campaña es obligatorio.'
    return
  }
  if (!newStartDate.value) {
    newError.value = 'La fecha de inicio es obligatoria.'
    return
  }
  if (!newEndDate.value) {
    newError.value = 'La fecha de fin es obligatoria.'
    return
  }
  if (newEndDate.value < newStartDate.value) {
    newError.value = 'La fecha de fin debe ser posterior a la fecha de inicio.'
    return
  }

  try {
    newSaving.value = true
    await createCampaign({
      name:       newName.value,
      start_date: newStartDate.value,
      end_date:   newEndDate.value,
    })
    newSuccess.value = true
    resetNewForm()
    await loadList()
    setTimeout(() => { newSuccess.value = false }, 3000)
    activeTab.value = 'list'
  } catch (err) {
    newError.value = errMsg(err, 'Error al crear la campaña.')
  } finally {
    newSaving.value = false
  }
}

// ── Edit modal ─────────────────────────────────────────────────────────────
const editOpen      = ref(false)
const editId        = ref('')
const editName      = ref('')
const editStartDate = ref('')
const editEndDate   = ref('')
const editSaving    = ref(false)
const editError     = ref('')

function openEdit(c: Campaign) {
  editId.value        = c.id
  editName.value      = c.name
  editStartDate.value = c.start_date
  editEndDate.value   = c.end_date
  editError.value     = ''
  editOpen.value      = true
}

function closeEdit() {
  editOpen.value = false
}

async function handleUpdate() {
  editError.value = ''
  if (!editName.value.trim()) {
    editError.value = 'El nombre de la campaña es obligatorio.'
    return
  }
  if (!editStartDate.value) {
    editError.value = 'La fecha de inicio es obligatoria.'
    return
  }
  if (!editEndDate.value) {
    editError.value = 'La fecha de fin es obligatoria.'
    return
  }
  if (editEndDate.value < editStartDate.value) {
    editError.value = 'La fecha de fin debe ser posterior a la fecha de inicio.'
    return
  }

  try {
    editSaving.value = true
    await updateCampaign(editId.value, {
      name:       editName.value,
      start_date: editStartDate.value,
      end_date:   editEndDate.value,
    })
    closeEdit()
    await loadList()
  } catch (err) {
    editError.value = errMsg(err, 'Error al actualizar la campaña.')
  } finally {
    editSaving.value = false
  }
}

// ── Delete modal ───────────────────────────────────────────────────────────
const deleteOpen      = ref(false)
const deleteId        = ref('')
const deleteName      = ref('')
const deleteIsActive  = ref(false)
const deleteDeleting  = ref(false)
const deleteError     = ref('')

function openDelete(c: Campaign) {
  deleteId.value       = c.id
  deleteName.value     = c.name
  deleteIsActive.value = c.is_active
  deleteError.value    = ''
  deleteOpen.value     = true
}

function closeDelete() {
  deleteOpen.value = false
}

async function handleDelete() {
  deleteError.value   = ''
  deleteDeleting.value = true
  try {
    await deleteCampaign(deleteId.value)
    closeDelete()
    if (listPage.value > 1 && listRows.value.length === 1) listPage.value--
    await loadList()
  } catch (err) {
    deleteError.value = errMsg(err, 'Error al eliminar la campaña.')
  } finally {
    deleteDeleting.value = false
  }
}

// ── Init ───────────────────────────────────────────────────────────────────
onMounted(loadList)
</script>

<template>
  <div class="p-4 sm:p-6 max-w-5xl mx-auto">

    <!-- Header -->
    <div class="mb-6">
      <div class="flex items-center gap-3 mb-1">
        <h1 class="text-2xl font-bold text-[#04395a]">Campañas</h1>
        <span
          v-if="!listLoading && listCount > 0"
          class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#04395a]/10 text-[#04395a]"
        >
          {{ listCount }}
        </span>
      </div>
      <p class="text-sm text-gray-500">
        Gestión de campañas de registro. Solo una campaña puede estar activa a la vez.
        Las fichas solo pueden crearse durante el período vigente de la campaña activa.
      </p>
    </div>

    <!-- Card -->
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

      <!-- Tabs -->
      <div class="px-6 pt-4">
        <Tabs :tabs="tabs" v-model="activeTab" />
      </div>

      <!-- ── LISTADO ──────────────────────────────────────────────────────── -->
        <div v-show="activeTab === 'list'" class="px-6 pb-6">

          <!-- Activate error banner -->
          <div v-if="activateError" class="mt-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            {{ activateError }}
          </div>

          <!-- Loading skeleton -->
          <div v-if="listLoading" class="mt-4 space-y-3">
            <div v-for="i in 3" :key="i" class="h-16 rounded-xl bg-gray-100 animate-pulse" />
          </div>

          <!-- Error state -->
          <div
            v-else-if="listError"
            class="mt-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            {{ listError }}
            <button type="button" @click="loadList" class="ml-auto text-xs underline hover:no-underline">Reintentar</button>
          </div>

          <!-- Empty state -->
          <div v-else-if="listRows.length === 0" class="mt-10 flex flex-col items-center gap-3 text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
            <p class="text-sm font-medium">Sin campañas registradas</p>
            <p class="text-xs">Usa la pestaña "Nueva" para crear la primera campaña.</p>
          </div>

          <!-- Table -->
          <div v-else class="mt-4">
            <!-- Desktop table -->
            <div class="hidden sm:block overflow-x-auto rounded-xl border border-gray-100">
              <table class="w-full text-sm">
                <thead>
                  <tr class="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                    <th class="px-4 py-3 text-left font-medium">Campaña</th>
                    <th class="px-4 py-3 text-left font-medium">Inicio</th>
                    <th class="px-4 py-3 text-left font-medium">Fin</th>
                    <th class="px-4 py-3 text-left font-medium">Estado</th>
                    <th class="px-4 py-3 text-right font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-50">
                  <tr
                    v-for="c in listRows"
                    :key="c.id"
                    :class="[
                      'transition-colors',
                      c.is_active ? 'bg-[#04395a]/[0.02]' : 'bg-white hover:bg-gray-50/60',
                    ]"
                  >
                    <td class="px-4 py-3 font-medium text-gray-800">
                      <div class="flex items-center gap-2">
                        <!-- Active indicator -->
                        <span
                          v-if="c.is_active"
                          class="inline-flex items-center justify-center w-2 h-2 rounded-full bg-green-500 shrink-0"
                          title="Campaña activa"
                        />
                        {{ c.name }}
                      </div>
                    </td>
                    <td class="px-4 py-3 text-gray-600">{{ formatDate(c.start_date) }}</td>
                    <td class="px-4 py-3 text-gray-600">{{ formatDate(c.end_date) }}</td>
                    <td class="px-4 py-3">
                      <span
                        :class="['inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium', campaignStatus(c).classes]"
                      >
                        {{ campaignStatus(c).label }}
                      </span>
                    </td>
                    <td class="px-4 py-3 text-right">
                      <div class="flex items-center justify-end gap-2">
                        <!-- Activate button (only when not active) -->
                        <button
                          v-if="!c.is_active"
                          type="button"
                          @click="handleSetActive(c)"
                          :disabled="!!activatingId"
                          class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#04395a]/10 text-[#04395a] hover:bg-[#04395a]/20 transition-colors disabled:opacity-50"
                          title="Activar campaña"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M5.636 5.636a9 9 0 1 0 12.728 0M12 3v9" />
                          </svg>
                          Activar
                        </button>
                        <!-- Edit -->
                        <button
                          type="button"
                          @click="openEdit(c)"
                          class="p-1.5 rounded-lg text-gray-400 hover:text-[#04395a] hover:bg-gray-100 transition-colors"
                          title="Editar"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                          </svg>
                        </button>
                        <!-- Delete -->
                        <button
                          type="button"
                          @click="openDelete(c)"
                          class="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Eliminar"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Mobile cards -->
            <div class="sm:hidden space-y-3 mt-2">
              <div
                v-for="c in listRows"
                :key="c.id"
                :class="[
                  'rounded-xl border p-4',
                  c.is_active ? 'border-[#04395a]/30 bg-[#04395a]/[0.02]' : 'border-gray-100 bg-white',
                ]"
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <p class="font-semibold text-gray-800 truncate flex items-center gap-2">
                      <span
                        v-if="c.is_active"
                        class="inline-flex w-2 h-2 rounded-full bg-green-500 shrink-0"
                      />
                      {{ c.name }}
                    </p>
                    <p class="text-xs text-gray-500 mt-1">
                      {{ formatDate(c.start_date) }} — {{ formatDate(c.end_date) }}
                    </p>
                  </div>
                  <span
                    :class="['inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0', campaignStatus(c).classes]"
                  >
                    {{ campaignStatus(c).label }}
                  </span>
                </div>
                <div class="mt-3 flex items-center gap-2">
                  <button
                    v-if="!c.is_active"
                    type="button"
                    @click="handleSetActive(c)"
                    :disabled="!!activatingId"
                    class="flex-1 py-1.5 rounded-lg text-xs font-medium bg-[#04395a]/10 text-[#04395a] hover:bg-[#04395a]/20 transition-colors disabled:opacity-50"
                  >
                    Activar
                  </button>
                  <button
                    type="button"
                    @click="openEdit(c)"
                    class="flex-1 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    @click="openDelete(c)"
                    class="flex-1 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>

            <!-- Pagination -->
            <div
              v-if="listTotalPages > 1 || listCount > 0"
              class="mt-4 flex items-center justify-between text-xs text-gray-500"
            >
              <span>{{ listFrom }}–{{ listTo }} de {{ listCount }}</span>
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  @click="listPage--"
                  :disabled="listPage <= 1"
                  class="px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ‹
                </button>
                <span class="px-3">{{ listPage }} / {{ listTotalPages }}</span>
                <button
                  type="button"
                  @click="listPage++"
                  :disabled="listPage >= listTotalPages"
                  class="px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ›
                </button>
              </div>
            </div>
          </div>
        </div>

      <!-- ── NUEVA ────────────────────────────────────────────────────────── -->
      <div v-show="activeTab === 'new'" class="px-6 pb-6">
        <div class="mt-2 max-w-md">

          <!-- Success banner -->
          <Transition
            enter-active-class="transition-all duration-300"
            enter-from-class="opacity-0 -translate-y-1"
            leave-active-class="transition-all duration-200"
            leave-to-class="opacity-0 -translate-y-1"
          >
            <div
              v-if="newSuccess"
              class="mb-4 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              Campaña creada y activada correctamente.
            </div>
          </Transition>

          <!-- Error banner -->
          <div
            v-if="newError"
            class="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            {{ newError }}
          </div>

          <!-- Info note -->
          <div class="mb-5 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs flex items-start gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
            </svg>
            Al crear una nueva campaña se activará automáticamente y la campaña anterior (si existe) quedará inactiva.
          </div>

          <!-- Form -->
          <form @submit.prevent="handleCreate" class="space-y-5">

            <!-- Name -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">
                Nombre de la campaña <span class="text-red-500">*</span>
              </label>
              <input
                v-model="newName"
                type="text"
                placeholder="Ej: Campaña Bautismal 2026 – Semestre I"
                maxlength="120"
                class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#04395a]/30 focus:border-[#04395a] transition-colors"
              />
            </div>

            <!-- Dates row -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">
                  Fecha de inicio <span class="text-red-500">*</span>
                </label>
                <input
                  v-model="newStartDate"
                  type="date"
                  class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#04395a]/30 focus:border-[#04395a] transition-colors"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">
                  Fecha de fin <span class="text-red-500">*</span>
                </label>
                <input
                  v-model="newEndDate"
                  type="date"
                  :min="newStartDate || undefined"
                  class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#04395a]/30 focus:border-[#04395a] transition-colors"
                />
              </div>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-3 pt-1">
              <button
                type="submit"
                :disabled="newSaving"
                class="px-5 py-2.5 rounded-xl bg-[#04395a] text-white text-sm font-semibold hover:bg-[#04395a]/90 focus:outline-none focus:ring-2 focus:ring-[#04395a]/30 transition-colors disabled:opacity-60"
              >
                <span v-if="newSaving">Guardando…</span>
                <span v-else>Crear campaña</span>
              </button>
              <button
                type="button"
                @click="resetNewForm"
                :disabled="newSaving"
                class="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-60"
              >
                Limpiar
              </button>
            </div>
          </form>
        </div>
      </div>

    </div><!-- /card -->
  </div><!-- /page -->

  <!-- ── EDIT MODAL ──────────────────────────────────────────────────────── -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-200"
      enter-from-class="opacity-0"
      leave-active-class="transition-all duration-200"
      leave-to-class="opacity-0"
    >
      <div
        v-if="editOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
        @click.self="closeEdit"
      >
        <Transition
          enter-active-class="transition-all duration-200"
          enter-from-class="opacity-0 scale-95"
          leave-active-class="transition-all duration-150"
          leave-to-class="opacity-0 scale-95"
        >
          <div v-if="editOpen" class="w-full max-w-md bg-white rounded-2xl shadow-xl p-6">

            <!-- Modal header -->
            <div class="flex items-center justify-between mb-5">
              <h2 class="text-lg font-semibold text-[#04395a]">Editar campaña</h2>
              <button
                type="button"
                @click="closeEdit"
                class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <!-- Error -->
            <div
              v-if="editError"
              class="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm"
            >
              {{ editError }}
            </div>

            <!-- Form -->
            <form @submit.prevent="handleUpdate" class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">
                  Nombre <span class="text-red-500">*</span>
                </label>
                <input
                  v-model="editName"
                  type="text"
                  maxlength="120"
                  class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#04395a]/30 focus:border-[#04395a] transition-colors"
                />
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">
                    Inicio <span class="text-red-500">*</span>
                  </label>
                  <input
                    v-model="editStartDate"
                    type="date"
                    class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#04395a]/30 focus:border-[#04395a] transition-colors"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">
                    Fin <span class="text-red-500">*</span>
                  </label>
                  <input
                    v-model="editEndDate"
                    type="date"
                    :min="editStartDate || undefined"
                    class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#04395a]/30 focus:border-[#04395a] transition-colors"
                  />
                </div>
              </div>

              <div class="flex gap-3 pt-1">
                <button
                  type="submit"
                  :disabled="editSaving"
                  class="flex-1 py-2.5 rounded-xl bg-[#04395a] text-white text-sm font-semibold hover:bg-[#04395a]/90 transition-colors disabled:opacity-60"
                >
                  <span v-if="editSaving">Guardando…</span>
                  <span v-else>Guardar cambios</span>
                </button>
                <button
                  type="button"
                  @click="closeEdit"
                  :disabled="editSaving"
                  class="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-60"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>

  <!-- ── DELETE MODAL ────────────────────────────────────────────────────── -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-200"
      enter-from-class="opacity-0"
      leave-active-class="transition-all duration-200"
      leave-to-class="opacity-0"
    >
      <div
        v-if="deleteOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
        @click.self="closeDelete"
      >
        <Transition
          enter-active-class="transition-all duration-200"
          enter-from-class="opacity-0 scale-95"
        >
          <div v-if="deleteOpen" class="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6">

            <div class="flex items-center gap-3 mb-3">
              <div class="flex items-center justify-center w-10 h-10 rounded-full bg-red-100 shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
              </div>
              <h2 class="text-base font-semibold text-gray-800">Eliminar campaña</h2>
            </div>

            <p class="text-sm text-gray-600 mb-2">
              ¿Estás seguro de que deseas eliminar
              <strong class="text-gray-800">{{ deleteName }}</strong>?
              Esta acción no se puede deshacer.
            </p>

            <!-- Warning if active -->
            <div
              v-if="deleteIsActive"
              class="mb-4 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs"
            >
              Esta es la campaña activa. Al eliminarla, no habrá ninguna campaña activa hasta que configures una nueva.
            </div>

            <div
              v-if="deleteError"
              class="mb-4 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm"
            >
              {{ deleteError }}
            </div>

            <div class="flex gap-3">
              <button
                type="button"
                @click="handleDelete"
                :disabled="deleteDeleting"
                class="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                <span v-if="deleteDeleting">Eliminando…</span>
                <span v-else>Sí, eliminar</span>
              </button>
              <button
                type="button"
                @click="closeDelete"
                :disabled="deleteDeleting"
                class="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-60"
              >
                Cancelar
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
