<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useToastStore } from '@/stores/toast'
import { usePermissions } from '@/composables/usePermissions'
import Tabs, { type Tab } from '@/components/ui/Tabs.vue'
import {
  getCandidates,
  deleteCandidate,
  createCandidate,
  getCandidateIdByStudentId,
  type CandidateRow,
  type CandidateStatus,
} from '@/modules/candidates/services/candidates.service'
import { useCampaignStore } from '@/modules/campaigns/store/campaign.store'
import { searchStudents, type Student } from '@/modules/students/services/students.service'
import { supabase } from '@/core/supabase'

const router = useRouter()
const toast = useToastStore()
const { canWrite } = usePermissions()
const campaignStore = useCampaignStore()
const { selected: selectedCampaign } = storeToRefs(campaignStore)

// Nombre del usuario actual (igual que ValidationView)
const currentUserName = ref<string | null>(null)

// ── Tabs ───────────────────────────────────────────────────────────────────

const tabs: Tab[] = [
  { key: 'list', label: 'Listado' },
  /* { key: 'new', label: 'Nuevo' }, */
  { key: 'drafts', label: 'Pendientes' },
  { key: 'completed', label: 'Completados' },
]
const activeTab = ref('list')

// ── Shared helpers ─────────────────────────────────────────────────────────

function statusLabel(s: CandidateStatus) {
  return s === 'draft' ? 'Borrador' : 'Completado'
}
function statusClass(s: CandidateStatus) {
  return s === 'draft' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
}

function toProperCase(str: string | null | undefined): string {
  if (!str) return '—'
  return str.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
}

function limaDateTime(dateStr: string): string {
  // Fuerza lectura como UTC y aplica offset Lima (UTC-5)
  const raw =
    dateStr.endsWith('Z') || dateStr.includes('+') ? dateStr : dateStr.replace(' ', 'T') + 'Z'
  const lima = new Date(new Date(raw).getTime() - 5 * 60 * 60 * 1000)
  const dd = String(lima.getUTCDate()).padStart(2, '0')
  const mm = String(lima.getUTCMonth() + 1).padStart(2, '0')
  const yyyy = lima.getUTCFullYear()
  const hh = String(lima.getUTCHours()).padStart(2, '0')
  const min = String(lima.getUTCMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}

function limaDate(dateStr: string): string {
  return limaDateTime(dateStr).slice(0, 10)
}

function isMinor(row: CandidateRow): boolean {
  const birth = row.students?.birth_date ?? row.teachers?.birth_date
  if (!birth) return false
  const today = new Date()
  const b = new Date(birth)
  const age = today.getFullYear() - b.getFullYear() -
    (today.getMonth() < b.getMonth() || (today.getMonth() === b.getMonth() && today.getDate() < b.getDate()) ? 1 : 0)
  return age < 18
}

// ── List tab ───────────────────────────────────────────────────────────────

const listLoading = ref(false)
const listRows = ref<CandidateRow[]>([])
const listTotal = ref(0)
const listPage = ref(1)
const listPageSize = ref(8)
const listSearch = ref('')
const listDeleteId = ref<string | null>(null)
const listDeleting = ref(false)

async function loadList() {
  listLoading.value = true
  try {
    const res = await getCandidates(listPage.value, listPageSize.value, undefined, listSearch.value, selectedCampaign.value?.id ?? null)
    listRows.value = res.data
    listTotal.value = res.count
  } finally {
    listLoading.value = false
  }
}

watch(listSearch, () => {
  listPage.value = 1
  loadList()
})

const listTotalPages = () => Math.max(1, Math.ceil(listTotal.value / listPageSize.value))

function listPages() {
  const total = listTotalPages()
  const cur = listPage.value
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '...')[] = [1]
  if (cur > 3) pages.push('...')
  for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) pages.push(i)
  if (cur < total - 2) pages.push('...')
  pages.push(total)
  return pages
}

const draftsTotalPages = () => Math.max(1, Math.ceil(draftsTotal.value / draftsPageSize.value))

function draftsPages() {
  const total = draftsTotalPages()
  const cur = draftsPage.value
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '...')[] = [1]
  if (cur > 3) pages.push('...')
  for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) pages.push(i)
  if (cur < total - 2) pages.push('...')
  pages.push(total)
  return pages
}

const completedTotalPages = () => Math.max(1, Math.ceil(completedTotal.value / completedPageSize.value))

function completedPages() {
  const total = completedTotalPages()
  const cur = completedPage.value
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '...')[] = [1]
  if (cur > 3) pages.push('...')
  for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) pages.push(i)
  if (cur < total - 2) pages.push('...')
  pages.push(total)
  return pages
}

async function confirmDelete(id: string) {
  listDeleteId.value = id
}
async function executeDelete() {
  if (!listDeleteId.value) return
  listDeleting.value = true
  try {
    await deleteCandidate(listDeleteId.value)
    listDeleteId.value = null
    await Promise.all([loadList(), loadDrafts()])
    router.replace({ query: { deleted: '1' } })
  } finally {
    listDeleting.value = false
  }
}

watch([listPage, listPageSize], loadList)
onMounted(async () => {
  loadList()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .maybeSingle()
    currentUserName.value = profile?.full_name ?? profile?.email ?? user.email ?? null
  }
})

// ── Drafts tab ─────────────────────────────────────────────────────────────

const draftsLoading = ref(false)
const draftsRows = ref<CandidateRow[]>([])
const draftsTotal = ref(0)
const draftsPage = ref(1)
const draftsPageSize = ref(10)
const draftsSearch = ref('')

async function loadDrafts() {
  draftsLoading.value = true
  try {
    const res = await getCandidates(
      draftsPage.value,
      draftsPageSize.value,
      'draft',
      draftsSearch.value,
      selectedCampaign.value?.id ?? null,
    )
    draftsRows.value = res.data
    draftsTotal.value = res.count
  } finally {
    draftsLoading.value = false
  }
}

watch([draftsPage, draftsPageSize], loadDrafts)
watch(draftsSearch, () => {
  draftsPage.value = 1
  loadDrafts()
})

// ── Completed tab ──────────────────────────────────────────────────────────

const completedLoading = ref(false)
const completedRows = ref<CandidateRow[]>([])
const completedTotal = ref(0)
const completedPage = ref(1)
const completedPageSize = ref(10)
const completedSearch = ref('')

async function loadCompleted() {
  completedLoading.value = true
  try {
    const res = await getCandidates(
      completedPage.value,
      completedPageSize.value,
      'completed',
      completedSearch.value,
      selectedCampaign.value?.id ?? null,
    )
    completedRows.value = res.data
    completedTotal.value = res.count
  } finally {
    completedLoading.value = false
  }
}

watch([completedPage, completedPageSize], loadCompleted)
watch(completedSearch, () => {
  completedPage.value = 1
  loadCompleted()
})

// Load filtered tabs on first switch
watch(activeTab, (tab) => {
  if (tab === 'drafts' && draftsRows.value.length === 0 && !draftsLoading.value) loadDrafts()
  if (tab === 'completed' && completedRows.value.length === 0 && !completedLoading.value)
    loadCompleted()
})

// Reload all tabs when campaign changes
watch(selectedCampaign, () => {
  listPage.value    = 1
  draftsPage.value  = 1
  completedPage.value = 1
  loadList()
  if (draftsRows.value.length > 0 || activeTab.value === 'drafts')   loadDrafts()
  if (completedRows.value.length > 0 || activeTab.value === 'completed') loadCompleted()
})

// ── New candidate tab ──────────────────────────────────────────────────────

const searchQuery = ref('')
const searchResults = ref<Student[]>([])
const searchLoading = ref(false)
const selectedStudent = ref<Student | null>(null)
const existingCandidateId = ref<string | null>(null)
const checkingDuplicate = ref(false)
const creating = ref(false)
const createError = ref('')
const campaignError = ref('')

let searchTimer: ReturnType<typeof setTimeout> | null = null

watch(searchQuery, (val) => {
  // El usuario modificó el campo manualmente: limpiar selección y estado
  selectedStudent.value = null
  existingCandidateId.value = null
  if (!val.trim()) {
    searchResults.value = []
    return
  }
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(async () => {
    searchLoading.value = true
    try {
      const isNumeric = /^\d+$/.test(val.trim())
      searchResults.value = await searchStudents(
        isNumeric ? { dni: val.trim() } : { name: val.trim() },
      )
    } finally {
      searchLoading.value = false
    }
  }, 400)
})

async function selectStudent(s: Student) {
  // NO modificar searchQuery aquí: evita que el watcher limpie selectedStudent
  selectedStudent.value = s
  searchResults.value = []
  existingCandidateId.value = null
  checkingDuplicate.value = true
  try {
    existingCandidateId.value = await getCandidateIdByStudentId(s.id)
    if (existingCandidateId.value) {
      await router.push({ path: `/candidates/${existingCandidateId.value}`, query: { dup: '1' } })
      return
    }
  } finally {
    checkingDuplicate.value = false
  }
}

async function handleCreate() {
  if (!selectedStudent.value) return
  creating.value = true
  createError.value = ''
  campaignError.value = ''
  try {
    // Validar campaña seleccionada en el dropdown
    const campaignCheck = campaignStore.checkValidity()
    if (!campaignCheck.allowed) {
      const reason = campaignCheck.reason ?? 'No hay una campaña vigente para crear fichas.'
      campaignError.value = reason
      campaignStore.notify('No se puede crear la ficha', reason, 'error')
      creating.value = false
      return
    }
    const existing = await getCandidateIdByStudentId(selectedStudent.value.id)
    if (existing) {
      await router.push({ path: `/candidates/${existing}`, query: { dup: '1' } })
      return
    }
    const id = await createCandidate(selectedStudent.value.id, currentUserName.value)
    await router.push(`/candidates/${id}`)
  } catch (e: unknown) {
    createError.value = e instanceof Error ? e.message : 'Error al crear la ficha.'
    creating.value = false
  }
}

function resetNew() {
  searchQuery.value = ''
  searchResults.value = []
  selectedStudent.value = null
  existingCandidateId.value = null
  createError.value = ''
  campaignError.value = ''
}

watch(activeTab, (tab) => {
  if (tab === 'new') resetNew()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-start justify-between flex-wrap gap-3">
      <div>
        <h2 class="text-2xl font-bold text-[#04395a]">Fichas</h2>
        <p class="text-sm text-gray-500 mt-0.5">
          <template v-if="selectedCampaign">
            Campaña: <span class="font-semibold text-[#04395a]">{{ selectedCampaign.name }}</span>
          </template>
          <template v-else>Gestión de fichas de candidatos.</template>
        </p>
      </div>
      <!-- <button
        type="button"
        @click="activeTab = 'new'"
        class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[#04395a] hover:bg-[#068ab8] transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="2"
          stroke="currentColor"
          class="w-4 h-4"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Nuevo candidato
      </button>  -->
    </div>

    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="px-6 pt-4">
        <Tabs v-model="activeTab" :tabs="tabs" />
      </div>

      <div class="px-6 pb-6">
        <!-- ══ LISTADO ══════════════════════════════════════════════════════ -->
        <div v-show="activeTab === 'list'" class="pt-2">
          <!-- Search -->
          <div class="relative mb-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="#9ca3af"
              class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
              />
            </svg>
            <input
              v-model="listSearch"
              type="text"
              placeholder="Buscar por nombre, DNI o código…"
              class="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a]/40 placeholder:text-gray-400"
            />
            <button
              v-if="listSearch"
              @click="listSearch = ''"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
                class="w-3.5 h-3.5"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <!-- Skeleton -->
          <template v-if="listLoading">
            <div
              class="hidden md:grid grid-cols-[1fr_1fr_1fr_auto_auto] gap-x-4 gap-y-0 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100 pb-2 mb-1"
            >
              <span>Estudiante</span><span>Programa</span><span>Sede</span><span>Estado</span
              ><span></span>
            </div>
            <div
              v-for="i in listPageSize"
              :key="i"
              class="h-12 rounded-xl bg-gray-100 mb-2 animate-pulse"
              :style="{ opacity: 1 - i * 0.06 }"
            />
          </template>

          <!-- Empty -->
          <template v-else-if="listRows.length === 0">
            <div class="flex flex-col items-center justify-center py-20 text-center">
              <div class="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.3"
                  stroke="#04395a"
                  class="w-6 h-6"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                  />
                </svg>
              </div>
              <p class="text-sm font-medium text-gray-500">Sin candidatos registrados</p>
              <p class="text-xs text-gray-400 mt-1">
                Crea la primera ficha desde la pestaña "Nuevo".
              </p>
            </div>
          </template>

          <!-- Table (desktop) -->
          <template v-else>
            <div class="hidden md:block overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr
                    class="text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100"
                  >
                    <th class="text-left py-2 pr-3 font-semibold w-8">#</th>
                    <th class="text-left py-2 pr-4 font-semibold">Nombre</th>
                    <th class="text-left py-2 pr-4 font-semibold">Estado</th>
                    <th class="text-center py-2 pr-3 font-semibold">Identificación</th>
                    <th class="text-center py-2 pr-3 font-semibold">Conversión</th>
                    <th class="text-center py-2 pr-3 font-semibold">Declaración</th>
                    <th class="text-center py-2 pr-4 font-semibold">Ceremonia</th>
                    <th class="text-left py-2 pr-4 font-semibold">Creado por</th>
                    <th class="py-2"></th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-50">
                  <tr
                    v-for="(row, i) in listRows"
                    :key="row.id"
                    class="hover:bg-gray-50 transition-colors group"
                  >
                    <td class="py-3 pr-3 text-xs text-gray-400 font-medium">
                      {{ (listPage - 1) * listPageSize + i + 1 }}
                    </td>
                    <td class="py-3 pr-4">
                      <p class="font-medium text-gray-800">
                        {{ toProperCase(row.students?.full_name ?? row.teachers?.full_name) }}
                      </p>
                      <p class="text-xs text-gray-400 font-mono mt-0.5 flex items-center gap-1.5">
                        {{ row.students?.dni ?? row.teachers?.dni ?? '—' }}
                        <span v-if="isMinor(row)"
                          class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-600">
                          Menor de edad
                        </span>
                      </p>
                    </td>
                    <td class="py-3 pr-4">
                      <span
                        class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
                        :class="statusClass(row.status)"
                      >
                        <span
                          class="w-1.5 h-1.5 rounded-full"
                          :class="row.status === 'draft' ? 'bg-amber-500' : 'bg-emerald-500'"
                        />
                        {{ statusLabel(row.status) }}
                      </span>
                    </td>
                    <td class="py-3 pr-3 text-center">
                      <span
                        class="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs"
                        :class="
                          row.identification_completed
                            ? 'bg-emerald-100 text-emerald-600'
                            : 'bg-gray-100 text-gray-400'
                        "
                      >
                        <svg
                          v-if="row.identification_completed"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke-width="2.5"
                          stroke="currentColor"
                          class="w-3 h-3"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="m4.5 12.75 6 6 9-13.5"
                          />
                        </svg>
                        <svg
                          v-else
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke-width="2"
                          stroke="currentColor"
                          class="w-3 h-3"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M6 18 18 6M6 6l12 12"
                          />
                        </svg>
                      </span>
                    </td>
                    <td class="py-3 pr-3 text-center">
                      <span
                        class="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs"
                        :class="
                          row.conversion_completed
                            ? 'bg-emerald-100 text-emerald-600'
                            : 'bg-gray-100 text-gray-400'
                        "
                      >
                        <svg
                          v-if="row.conversion_completed"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke-width="2.5"
                          stroke="currentColor"
                          class="w-3 h-3"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="m4.5 12.75 6 6 9-13.5"
                          />
                        </svg>
                        <svg
                          v-else
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke-width="2"
                          stroke="currentColor"
                          class="w-3 h-3"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M6 18 18 6M6 6l12 12"
                          />
                        </svg>
                      </span>
                    </td>
                    <td class="py-3 pr-3 text-center">
                      <span
                        class="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs"
                        :class="
                          row.faith_completed
                            ? 'bg-emerald-100 text-emerald-600'
                            : 'bg-gray-100 text-gray-400'
                        "
                      >
                        <svg
                          v-if="row.faith_completed"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke-width="2.5"
                          stroke="currentColor"
                          class="w-3 h-3"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="m4.5 12.75 6 6 9-13.5"
                          />
                        </svg>
                        <svg
                          v-else
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke-width="2"
                          stroke="currentColor"
                          class="w-3 h-3"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M6 18 18 6M6 6l12 12"
                          />
                        </svg>
                      </span>
                    </td>
                    <td class="py-3 pr-4 text-center">
                      <span
                        class="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs"
                        :class="
                          row.ceremony_data_completed
                            ? 'bg-emerald-100 text-emerald-600'
                            : 'bg-gray-100 text-gray-400'
                        "
                      >
                        <svg
                          v-if="row.ceremony_data_completed"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke-width="2.5"
                          stroke="currentColor"
                          class="w-3 h-3"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="m4.5 12.75 6 6 9-13.5"
                          />
                        </svg>
                        <svg
                          v-else
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke-width="2"
                          stroke="currentColor"
                          class="w-3 h-3"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M6 18 18 6M6 6l12 12"
                          />
                        </svg>
                      </span>
                    </td>
                    <td class="py-3 pr-4">
                      <p class="text-[10px] font-medium text-gray-500 truncate max-w-[120px]">
                        {{ row.created_by_name ?? '' }}
                      </p>
                      <p class="text-[10px] text-gray-400 mt-0.5">
                        {{ limaDateTime(row.created_at) }}
                      </p>
                    </td>
                    <td class="py-3">
                      <div class="flex items-center justify-end gap-1.5">
                        <!-- Borrador → lápiz; Completado → ojo -->
                        <RouterLink
                          :to="`/candidates/${row.id}`"
                          :class="
                            row.status === 'draft'
                              ? 'p-2 rounded-lg text-amber-600 bg-amber-50 hover:bg-amber-100 transition-colors'
                              : 'p-2 rounded-lg text-[#04395a] bg-blue-50 hover:bg-blue-100 transition-colors'
                          "
                          :title="row.status === 'draft' ? 'Editar ficha' : 'Ver ficha'"
                        >
                          <!-- Lápiz (borrador) -->
                          <svg
                            v-if="row.status === 'draft'"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke-width="1.5"
                            stroke="currentColor"
                            class="w-4 h-4"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                            />
                          </svg>
                          <!-- Ojo (completado) -->
                          <svg
                            v-else
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke-width="1.5"
                            stroke="currentColor"
                            class="w-4 h-4"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.641 0-8.573-3.007-9.963-7.178Z"
                            />
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                            />
                          </svg>
                        </RouterLink>
                        <button
                          v-if="canWrite && row.status !== 'completed'"
                          type="button"
                          @click="confirmDelete(row.id)"
                          class="p-2 rounded-lg text-red-500 bg-red-50 hover:bg-red-100 transition-colors"
                          title="Eliminar ficha"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke-width="1.5"
                            stroke="currentColor"
                            class="w-4 h-4"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                            />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Cards (mobile) -->
            <div class="md:hidden space-y-2">
              <div
                v-for="(row, i) in listRows"
                :key="row.id"
                class="border border-gray-100 rounded-xl p-4 space-y-2"
              >
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <p class="text-sm font-semibold text-gray-800">
                      <span class="text-gray-400 font-normal mr-1"
                        >{{ (listPage - 1) * listPageSize + i + 1 }}.</span
                      >{{ toProperCase(row.students?.full_name ?? row.teachers?.full_name) }}
                    </p>
                    <p class="text-xs text-gray-400 font-mono flex items-center gap-1.5">
                      {{ row.students?.dni ?? row.teachers?.dni ?? '—' }}
                      <span v-if="isMinor(row)"
                        class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-600">
                        Menor de edad
                      </span>
                    </p>
                  </div>
                  <span
                    class="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                    :class="statusClass(row.status)"
                  >
                    {{ statusLabel(row.status) }}
                  </span>
                </div>
                <!-- Progress badges -->
                <div class="flex items-center gap-1.5">
                  <span
                    v-for="(item, i) in [
                      { label: 'ID', done: row.identification_completed },
                      { label: 'Conv', done: row.conversion_completed },
                      { label: 'Fe', done: row.faith_completed },
                      { label: 'Cer', done: row.ceremony_data_completed },
                    ]"
                    :key="i"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                    :class="
                      item.done ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'
                    "
                  >
                    <svg
                      v-if="item.done"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke-width="2.5"
                      stroke="currentColor"
                      class="w-2.5 h-2.5"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="m4.5 12.75 6 6 9-13.5"
                      />
                    </svg>
                    {{ item.label }}
                  </span>
                </div>
                <div class="flex items-center justify-between pt-1">
                  <p class="text-[10px] text-gray-400 flex items-center gap-1 min-w-0">
                    <span class="truncate max-w-[100px]">{{ row.created_by_name ?? '' }}</span>
                    <span class="shrink-0">· {{ limaDate(row.created_at) }}</span>
                  </p>
                  <div class="flex gap-1.5">
                    <RouterLink
                      :to="`/candidates/${row.id}`"
                      :class="
                        row.status === 'draft'
                          ? 'p-2 rounded-lg text-amber-600 bg-amber-50 hover:bg-amber-100 transition-colors'
                          : 'p-2 rounded-lg text-[#04395a] bg-blue-50 hover:bg-blue-100 transition-colors'
                      "
                      :title="row.status === 'draft' ? 'Editar ficha' : 'Ver ficha'"
                    >
                      <svg
                        v-if="row.status === 'draft'"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="currentColor"
                        class="w-4 h-4"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                        />
                      </svg>
                      <svg
                        v-else
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="currentColor"
                        class="w-4 h-4"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.641 0-8.573-3.007-9.963-7.178Z"
                        />
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                        />
                      </svg>
                    </RouterLink>
                    <button
                      v-if="canWrite && row.status !== 'completed'"
                      type="button"
                      @click="confirmDelete(row.id)"
                      class="p-2 rounded-lg text-red-500 bg-red-50 hover:bg-red-100 transition-colors"
                      title="Eliminar ficha"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="currentColor"
                        class="w-4 h-4"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Pagination -->
            <div class="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
              <p class="text-xs text-gray-400">
                {{ (listPage - 1) * listPageSize + 1 }}–{{
                  Math.min(listPage * listPageSize, listTotal)
                }}
                de {{ listTotal }}
              </p>
              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  :disabled="listPage === 1"
                  @click="listPage--"
                  class="flex items-center gap-1 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  ← Ant.
                </button>
                <template v-for="p in listPages()" :key="String(p)">
                  <span
                    v-if="p === '...'"
                    class="w-10 h-10 flex items-center justify-center text-gray-400 text-sm"
                    >…</span
                  >
                  <button
                    v-else
                    type="button"
                    @click="listPage = p as number"
                    class="w-10 h-10 flex items-center justify-center rounded-xl text-sm font-medium transition-colors"
                    :class="
                      listPage === p
                        ? 'bg-[#04395a] text-white'
                        : 'text-gray-600 hover:bg-gray-100 border border-gray-200'
                    "
                  >
                    {{ p }}
                  </button>
                </template>
                <button
                  type="button"
                  :disabled="listPage === listTotalPages()"
                  @click="listPage++"
                  class="flex items-center gap-1 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Sig. →
                </button>
              </div>
            </div>
          </template>

          <!-- Delete confirm dialog -->
          <Teleport to="body">
            <Transition name="modal">
              <div
                v-if="listDeleteId"
                class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
                @click.self="listDeleteId = null"
              >
                <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
                  <div class="flex items-center gap-3">
                    <div
                      class="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="#ef4444"
                        class="w-5 h-5"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                        />
                      </svg>
                    </div>
                    <div>
                      <p class="text-sm font-semibold text-gray-800">¿Eliminar ficha?</p>
                      <p class="text-xs text-gray-400 mt-0.5">Esta acción no se puede deshacer.</p>
                    </div>
                  </div>
                  <div class="flex gap-2 pt-1">
                    <button
                      type="button"
                      @click="listDeleteId = null"
                      class="flex-1 py-2 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      @click="executeDelete"
                      :disabled="listDeleting"
                      class="flex-1 py-2 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 disabled:opacity-60 transition-colors"
                    >
                      {{ listDeleting ? 'Eliminando…' : 'Eliminar' }}
                    </button>
                  </div>
                </div>
              </div>
            </Transition>
          </Teleport>
        </div>

        <!-- ══ NUEVO ════════════════════════════════════════════════════════ -->
        <div v-show="activeTab === 'new'" class="pt-4 max-w-lg mx-auto space-y-4">
          <p class="text-sm text-gray-500">
            Busca el estudiante por nombre o DNI para crear su ficha de candidato.
          </p>

          <!-- Search input -->
          <div class="relative">
            <div class="pointer-events-none absolute inset-y-0 left-3 flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="#9ca3af"
                class="w-4 h-4"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 15.803a7.5 7.5 0 0 0 10.607 0Z"
                />
              </svg>
            </div>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Nombre o DNI del estudiante…"
              :class="[
                'w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border transition focus:outline-none focus:ring-2',
                existingCandidateId
                  ? 'border-red-400 bg-red-50 focus:ring-red-200 focus:border-red-500 text-red-700 placeholder-red-300'
                  : 'border-gray-200 focus:ring-[#04395a]/20 focus:border-[#04395a]',
              ]"
            />
            <div v-if="searchLoading" class="absolute inset-y-0 right-3 flex items-center">
              <svg class="animate-spin w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            </div>
          </div>

          <!-- Dropdown results -->
          <div
            v-if="searchResults.length > 0 && !selectedStudent"
            class="border border-gray-200 rounded-xl overflow-hidden shadow-sm"
          >
            <button
              v-for="s in searchResults"
              :key="s.id"
              type="button"
              @click="selectStudent(s)"
              class="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-100 last:border-0"
            >
              <div
                class="w-8 h-8 rounded-full bg-[#04395a]/10 flex items-center justify-center shrink-0 text-xs font-bold text-[#04395a]"
              >
                {{ s.full_name.charAt(0) }}
              </div>
              <div class="min-w-0">
                <p class="text-sm font-medium text-gray-800 truncate">{{ s.full_name }}</p>
                <p class="text-xs text-gray-400">DNI {{ s.dni }} · {{ s.program ?? '—' }}</p>
              </div>
            </button>
          </div>

          <!-- No results -->
          <div
            v-if="
              searchQuery.trim() && !searchLoading && searchResults.length === 0 && !selectedStudent
            "
            class="text-center py-6 text-xs text-gray-400"
          >
            No se encontraron estudiantes.
          </div>

          <!-- Selected student card -->
          <div
            v-if="selectedStudent"
            class="border border-[#04395a]/20 bg-[#04395a]/5 rounded-xl p-4 space-y-2"
          >
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-full bg-[#04395a]/15 flex items-center justify-center text-sm font-bold text-[#04395a]"
              >
                {{ selectedStudent.full_name.charAt(0) }}
              </div>
              <div>
                <p class="text-sm font-semibold text-gray-800">{{ selectedStudent.full_name }}</p>
                <p class="text-xs text-gray-500">DNI {{ selectedStudent.dni }}</p>
              </div>
              <button
                type="button"
                @click="resetNew()"
                class="ml-auto p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-white transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="2"
                  stroke="currentColor"
                  class="w-4 h-4"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div class="grid grid-cols-2 gap-1 text-xs text-gray-500">
              <span
                ><span class="font-medium">Programa:</span>
                {{ selectedStudent.program ?? '—' }}</span
              >
              <span
                ><span class="font-medium">Sede:</span> {{ selectedStudent.campus ?? '—' }}</span
              >
              <span
                ><span class="font-medium">Facultad:</span>
                {{ selectedStudent.faculty ?? '—' }}</span
              >
              <span
                ><span class="font-medium">Ciclo:</span> {{ selectedStudent.cycle ?? '—' }}</span
              >
            </div>
          </div>

          <!-- Duplicate warning -->
          <div
            v-if="existingCandidateId"
            class="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="#d97706"
              class="w-5 h-5 shrink-0 mt-0.5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-amber-800">
                Este estudiante ya tiene una ficha registrada.
              </p>
              <p class="text-xs text-amber-600 mt-0.5">
                Elimina la ficha existente antes de crear una nueva.
              </p>
            </div>
            <RouterLink
              :to="`/candidates/${existingCandidateId}`"
              class="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-800 bg-amber-100 hover:bg-amber-200 transition-colors whitespace-nowrap"
              >Ver ficha</RouterLink
            >
          </div>

          <!-- Error de campaña -->
          <div
            v-if="campaignError"
            class="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="#dc2626" class="w-5 h-5 shrink-0 mt-0.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
            <p class="text-sm font-medium text-red-700">{{ campaignError }}</p>
          </div>

          <!-- Error -->
          <p v-if="createError" class="text-xs text-red-500">{{ createError }}</p>

          <!-- Create button -->
          <button
            type="button"
            :disabled="!selectedStudent || creating || checkingDuplicate || !!existingCandidateId"
            @click="handleCreate"
            class="w-full py-2.5 rounded-xl text-sm font-medium text-white bg-[#04395a] hover:bg-[#068ab8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            <svg
              v-if="creating || checkingDuplicate"
              class="animate-spin w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            {{
              creating
                ? 'Creando ficha…'
                : checkingDuplicate
                  ? 'Verificando…'
                  : 'Crear ficha de candidato'
            }}
          </button>
        </div>

        <!-- ══ BORRADORES ════════════════════════════════════════════════════ -->
        <div v-show="activeTab === 'drafts'" class="pt-2">
          <!-- Search -->
          <div class="relative mb-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="#9ca3af"
              class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
              />
            </svg>
            <input
              v-model="draftsSearch"
              type="text"
              placeholder="Buscar por nombre, DNI o código…"
              class="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a]/40 placeholder:text-gray-400"
            />
            <button
              v-if="draftsSearch"
              @click="draftsSearch = ''"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
                class="w-3.5 h-3.5"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <template v-if="draftsLoading">
            <div
              v-for="i in 4"
              :key="i"
              class="h-12 rounded-xl bg-gray-100 mb-2 animate-pulse"
              :style="{ opacity: 1 - i * 0.15 }"
            />
          </template>
          <template v-else-if="draftsRows.length === 0">
            <div class="flex flex-col items-center justify-center py-20 text-center">
              <div class="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center mb-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="#f59e0b"
                  class="w-5 h-5"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                  />
                </svg>
              </div>
              <p class="text-sm font-medium text-gray-500">Sin fichas en borrador</p>
            </div>
          </template>
          <template v-else>
            <div class="hidden md:block overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr
                    class="text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100"
                  >
                    <th class="text-left py-2 pr-3 font-semibold w-8">#</th>
                    <th class="text-left py-2 pr-4 font-semibold">Estudiante</th>
                    <th class="text-left py-2 pr-4 font-semibold">Programa</th>
                    <th class="text-left py-2 pr-4 font-semibold">Creado por</th>
                    <th class="py-2"></th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-50">
                  <tr
                    v-for="(row, i) in draftsRows"
                    :key="row.id"
                    class="hover:bg-gray-50 transition-colors group"
                  >
                    <td class="py-3 pr-3 text-xs text-gray-400 font-medium">
                      {{ (draftsPage - 1) * draftsPageSize + i + 1 }}
                    </td>
                    <td class="py-3 pr-4">
                      <p class="font-medium text-gray-800">
                        {{ toProperCase(row.students?.full_name ?? row.teachers?.full_name) }}
                      </p>
                      <p class="text-xs text-gray-400 font-mono mt-0.5">
                        {{ row.students?.dni ?? row.teachers?.dni ?? '—' }}
                      </p>
                    </td>
                    <td class="py-3 pr-4 text-gray-500 text-xs">
                      {{ row.students?.program ?? row.teachers?.main_ep ?? '—' }}
                    </td>
                    <td class="py-3 pr-4">
                      <p class="text-[10px] font-medium text-gray-500 truncate max-w-[120px]">
                        {{ row.created_by_name ?? '' }}
                      </p>
                      <p class="text-[10px] text-gray-400 mt-0.5">{{ limaDateTime(row.created_at) }}</p>
                    </td>
                    <td class="py-3">
                      <div class="flex items-center justify-end gap-1.5">
                        <RouterLink
                          :to="`/candidates/${row.id}`"
                          class="p-2 rounded-lg text-amber-600 bg-amber-50 hover:bg-amber-100 transition-colors"
                          title="Editar ficha"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke-width="1.5"
                            stroke="currentColor"
                            class="w-4 h-4"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                            />
                          </svg>
                        </RouterLink>
                        <button
                          v-if="canWrite"
                          type="button"
                          @click="confirmDelete(row.id)"
                          class="p-2 rounded-lg text-red-500 bg-red-50 hover:bg-red-100 transition-colors"
                          title="Eliminar ficha"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke-width="1.5"
                            stroke="currentColor"
                            class="w-4 h-4"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                            />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="md:hidden space-y-2">
              <div
                v-for="(row, i) in draftsRows"
                :key="row.id"
                class="border border-amber-100 bg-amber-50/40 rounded-xl p-4"
              >
                <p class="text-sm font-semibold text-gray-800">
                  <span class="text-gray-400 font-normal mr-1"
                    >{{ (draftsPage - 1) * draftsPageSize + i + 1 }}.</span
                  >{{ toProperCase(row.students?.full_name ?? row.teachers?.full_name) }}
                </p>
                <p class="text-xs text-gray-400 font-mono">
                  {{ row.students?.dni ?? row.teachers?.dni ?? '—' }}
                </p>
                <p class="text-xs text-gray-500 mt-1">
                  {{ row.students?.program ?? row.teachers?.main_ep ?? '—' }}
                </p>
                <div class="flex items-center justify-between mt-3">
                  <p class="text-[10px] text-gray-400 flex items-center gap-1 min-w-0">
                    <span class="truncate max-w-[100px]">{{ row.created_by_name ?? '' }}</span>
                    <span class="shrink-0">· {{ limaDateTime(row.created_at) }}</span>
                  </p>
                  <div class="flex gap-1.5">
                    <RouterLink
                      :to="`/candidates/${row.id}`"
                      class="p-2 rounded-lg text-amber-600 bg-amber-50 hover:bg-amber-100 transition-colors"
                      title="Editar ficha"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="currentColor"
                        class="w-4 h-4"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                        />
                      </svg>
                    </RouterLink>
                    <button
                      v-if="canWrite"
                      type="button"
                      @click="confirmDelete(row.id)"
                      class="p-2 rounded-lg text-red-500 bg-red-50 hover:bg-red-100 transition-colors"
                      title="Eliminar ficha"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="currentColor"
                        class="w-4 h-4"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <!-- Drafts pagination -->
            <div class="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
              <p class="text-xs text-gray-400">
                {{ (draftsPage - 1) * draftsPageSize + 1 }}–{{ Math.min(draftsPage * draftsPageSize, draftsTotal) }}
                de {{ draftsTotal }}
              </p>
              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  :disabled="draftsPage === 1"
                  @click="draftsPage--"
                  class="flex items-center gap-1 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  ← Ant.
                </button>
                <template v-for="p in draftsPages()" :key="String(p)">
                  <span
                    v-if="p === '...'"
                    class="w-10 h-10 flex items-center justify-center text-gray-400 text-sm"
                    >…</span
                  >
                  <button
                    v-else
                    type="button"
                    @click="draftsPage = p as number"
                    class="w-10 h-10 flex items-center justify-center rounded-xl text-sm font-medium transition-colors"
                    :class="
                      draftsPage === p
                        ? 'bg-[#04395a] text-white'
                        : 'text-gray-600 hover:bg-gray-100 border border-gray-200'
                    "
                  >
                    {{ p }}
                  </button>
                </template>
                <button
                  type="button"
                  :disabled="draftsPage === draftsTotalPages()"
                  @click="draftsPage++"
                  class="flex items-center gap-1 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Sig. →
                </button>
              </div>
            </div>
          </template>
        </div>

        <!-- ══ COMPLETADOS ════════════════════════════════════════════════════ -->
        <div v-show="activeTab === 'completed'" class="pt-2">
          <!-- Search -->
          <div class="relative mb-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="#9ca3af"
              class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
              />
            </svg>
            <input
              v-model="completedSearch"
              type="text"
              placeholder="Buscar por nombre, DNI o código…"
              class="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a]/40 placeholder:text-gray-400"
            />
            <button
              v-if="completedSearch"
              @click="completedSearch = ''"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
                class="w-3.5 h-3.5"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <template v-if="completedLoading">
            <div
              v-for="i in 4"
              :key="i"
              class="h-12 rounded-xl bg-gray-100 mb-2 animate-pulse"
              :style="{ opacity: 1 - i * 0.15 }"
            />
          </template>
          <template v-else-if="completedRows.length === 0">
            <div class="flex flex-col items-center justify-center py-20 text-center">
              <div
                class="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mb-3"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="#10b981"
                  class="w-5 h-5"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              <p class="text-sm font-medium text-gray-500">Sin fichas completadas</p>
            </div>
          </template>
          <template v-else>
            <div class="hidden md:block overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr
                    class="text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100"
                  >
                    <th class="text-left py-2 pr-3 font-semibold w-8">#</th>
                    <th class="text-left py-2 pr-4 font-semibold">Estudiante</th>
                    <th class="text-left py-2 pr-4 font-semibold">Programa</th>
                    <th class="text-left py-2 pr-4 font-semibold">Creado por</th>
                    <th class="py-2"></th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-50">
                  <tr
                    v-for="(row, i) in completedRows"
                    :key="row.id"
                    class="hover:bg-gray-50 transition-colors group"
                  >
                    <td class="py-3 pr-3 text-xs text-gray-400 font-medium">
                      {{ (completedPage - 1) * completedPageSize + i + 1 }}
                    </td>
                    <td class="py-3 pr-4">
                      <p class="font-medium text-gray-800">
                        {{ toProperCase(row.students?.full_name ?? row.teachers?.full_name) }}
                      </p>
                      <p class="text-xs text-gray-400 font-mono mt-0.5">
                        {{ row.students?.dni ?? row.teachers?.dni ?? '—' }}
                      </p>
                    </td>
                    <td class="py-3 pr-4 text-gray-500 text-xs">
                      {{ row.students?.program ?? row.teachers?.main_ep ?? '—' }}
                    </td>
                    <td class="py-3 pr-4">
                      <p class="text-[10px] font-medium text-gray-500 truncate max-w-[120px]">
                        {{ row.created_by_name ?? '' }}
                      </p>
                      <p class="text-[10px] text-gray-400 mt-0.5">{{ limaDateTime(row.created_at) }}</p>
                    </td>
                    <td class="py-3">
                      <div class="flex items-center justify-end">
                        <RouterLink
                          :to="`/candidates/${row.id}`"
                          class="p-2 rounded-lg text-[#04395a] bg-blue-50 hover:bg-blue-100 transition-colors"
                          title="Ver ficha"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke-width="1.5"
                            stroke="currentColor"
                            class="w-4 h-4"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.641 0-8.573-3.007-9.963-7.178Z"
                            />
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                            />
                          </svg>
                        </RouterLink>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="md:hidden space-y-2">
              <div
                v-for="(row, i) in completedRows"
                :key="row.id"
                class="border border-emerald-100 bg-emerald-50/40 rounded-xl p-4"
              >
                <p class="text-sm font-semibold text-gray-800">
                  <span class="text-gray-400 font-normal mr-1"
                    >{{ (completedPage - 1) * completedPageSize + i + 1 }}.</span
                  >{{ toProperCase(row.students?.full_name ?? row.teachers?.full_name) }}
                </p>
                <p class="text-xs text-gray-400 font-mono">
                  {{ row.students?.dni ?? row.teachers?.dni ?? '—' }}
                </p>
                <p class="text-xs text-gray-500 mt-1">
                  {{ row.students?.program ?? row.teachers?.main_ep ?? '—' }}
                </p>
                <div class="flex items-center justify-between mt-3">
                  <p class="text-[10px] text-gray-400 flex items-center gap-1 min-w-0">
                    <span class="truncate max-w-[100px]">{{ row.created_by_name ?? '' }}</span>
                    <span class="shrink-0">· {{ limaDateTime(row.created_at) }}</span>
                  </p>
                  <RouterLink
                    :to="`/candidates/${row.id}`"
                    class="p-2 rounded-lg text-[#04395a] bg-blue-50 hover:bg-blue-100 transition-colors"
                    title="Ver ficha"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke-width="1.5"
                      stroke="currentColor"
                      class="w-4 h-4"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.641 0-8.573-3.007-9.963-7.178Z"
                      />
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                      />
                    </svg>
                  </RouterLink>
                </div>
              </div>
            </div>
            <!-- Completed pagination -->
            <div class="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
              <p class="text-xs text-gray-400">
                {{ (completedPage - 1) * completedPageSize + 1 }}–{{ Math.min(completedPage * completedPageSize, completedTotal) }}
                de {{ completedTotal }}
              </p>
              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  :disabled="completedPage === 1"
                  @click="completedPage--"
                  class="flex items-center gap-1 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  ← Ant.
                </button>
                <template v-for="p in completedPages()" :key="String(p)">
                  <span
                    v-if="p === '...'"
                    class="w-10 h-10 flex items-center justify-center text-gray-400 text-sm"
                    >…</span
                  >
                  <button
                    v-else
                    type="button"
                    @click="completedPage = p as number"
                    class="w-10 h-10 flex items-center justify-center rounded-xl text-sm font-medium transition-colors"
                    :class="
                      completedPage === p
                        ? 'bg-[#04395a] text-white'
                        : 'text-gray-600 hover:bg-gray-100 border border-gray-200'
                    "
                  >
                    {{ p }}
                  </button>
                </template>
                <button
                  type="button"
                  :disabled="completedPage === completedTotalPages()"
                  @click="completedPage++"
                  class="flex items-center gap-1 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Sig. →
                </button>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
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
.modal-enter-active > *,
.modal-leave-active > * {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}
.modal-enter-from > *,
.modal-leave-to > * {
  transform: scale(0.96) translateY(8px);
  opacity: 0;
}
</style>
