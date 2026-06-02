<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { searchStudents, searchLibre, createCandidateFromStudent, getCandidateMapForStudents } from '@/modules/students/services/students.service'
import { searchTeachers, createCandidateFromTeacher, getCandidateMapForTeachers } from '@/modules/teachers/services/teachers.service'
import { useToastStore } from '@/stores/toast'
import { usePermissions } from '@/composables/usePermissions'
import { supabase } from '@/core/supabase'
import { useCampaignStore } from '@/modules/campaigns/store/campaign.store'

// ── Types ──────────────────────────────────────────────────────────────────

type PersonType = 'student' | 'teacher' | 'libre'

interface SearchResult {
  id:               string
  full_name:        string
  dni:              string
  type:             PersonType
  program:          string | null
  faculty:          string | null
  campus:           string | null
  // extra for preview
  phone:            string | null
  birth_date:       string | null
  cycle:            string | null
  academic_degree:  string | null
  dedication_regime: string | null
  // candidate ficha id if already exists
  existingId:       string | null
}

// ── State ──────────────────────────────────────────────────────────────────

const router        = useRouter()
const toast         = useToastStore()
const campaignStore = useCampaignStore()
const { canWrite }  = usePermissions()
const query      = ref('')
const results    = ref<SearchResult[]>([])
const loading    = ref(false)
const navigating = ref(false)
const showDrop   = ref(false)
const wrapRef    = ref<HTMLElement | null>(null)
const inputRef   = ref<HTMLInputElement | null>(null)

// Preview modal
const preview    = ref<SearchResult | null>(null)
const showModal  = ref(false)
const existingCandidateId = ref<string | null>(null)
const checkingCandidate   = ref(false)

let debounce: ReturnType<typeof setTimeout>

// ── Search ─────────────────────────────────────────────────────────────────

watch(query, (val) => {
  clearTimeout(debounce)
  const q = val.trim()
  if (q.length < 2) {
    results.value = []
    showDrop.value = false
    return
  }
  debounce = setTimeout(() => doSearch(q), 300)
})

async function doSearch(q: string) {
  loading.value  = true
  showDrop.value = true
  try {
    const isNumeric = /^\d+$/.test(q)
    // Para estudiantes: búsqueda numérica compara contra student_code Y dni
    const studentParams = isNumeric ? { code: q } : { name: q }
    // Para docentes: solo dni o nombre (no tienen student_code)
    const teacherParams = isNumeric ? { dni: q } : { name: q }

    const [students, teachers, libres] = await Promise.all([
      searchStudents(studentParams),
      searchTeachers(teacherParams),
      searchLibre(studentParams),
    ])

    const topStudents = students.slice(0, 5)
    const topTeachers = teachers.slice(0, 5)
    const topLibres   = libres.slice(0, 5)

    // Bulk-check existing fichas for all results at once
    const [studentMap, teacherMap] = await Promise.all([
      getCandidateMapForStudents([...topStudents.map(s => s.id), ...topLibres.map(l => l.id)]),
      getCandidateMapForTeachers(topTeachers.map(t => t.id)),
    ])

    results.value = [
      ...topStudents.map(s => ({
        id:               s.id,
        full_name:        s.full_name,
        dni:              s.dni,
        type:             'student' as PersonType,
        program:          s.program,
        faculty:          s.faculty,
        campus:           s.campus,
        phone:            s.phone,
        birth_date:       s.birth_date,
        cycle:            s.cycle,
        academic_degree:  null,
        dedication_regime: null,
        existingId:       studentMap[s.id] ?? null,
      })),
      ...topTeachers.map(t => ({
        id:               t.id,
        full_name:        t.full_name,
        dni:              t.dni,
        type:             'teacher' as PersonType,
        program:          t.main_ep,
        faculty:          t.faculty,
        campus:           t.campus,
        phone:            null,
        birth_date:       null,
        cycle:            t.condition,
        academic_degree:  t.academic_degree,
        dedication_regime: t.dedication_regime,
        existingId:       teacherMap[t.id] ?? null,
      })),
      ...topLibres.map(l => ({
        id:               l.id,
        full_name:        l.full_name,
        dni:              l.dni,
        type:             'libre' as PersonType,
        program:          null,
        faculty:          null,
        campus:           l.campus,
        phone:            l.phone,
        birth_date:       l.birth_date,
        cycle:            null,
        academic_degree:  null,
        dedication_regime: null,
        existingId:       studentMap[l.id] ?? null,
      })),
    ]
  } catch {
    results.value = []
  } finally {
    loading.value = false
  }
}

// ── Preview modal ──────────────────────────────────────────────────────────

function openPreview(r: SearchResult) {
  preview.value             = r
  existingCandidateId.value = r.existingId
  showModal.value           = true
  showDrop.value            = false
  checkingCandidate.value   = false
}

function closeModal() {
  showModal.value  = false
  preview.value    = null
  existingCandidateId.value = null
}

// ── Create / open ficha ────────────────────────────────────────────────────

async function goToFicha(r: SearchResult, closeDropdown = true) {
  if (navigating.value) return
  // Guard: viewer cannot create fichas
  if (!existingCandidateId.value && !canWrite.value) return
  // Guard: campaign must be valid to create new fichas
  if (!existingCandidateId.value) {
    const campaignCheck = campaignStore.checkValidity()
    if (!campaignCheck.allowed) {
      campaignStore.notify('No se puede crear la ficha', campaignCheck.reason, 'error')
      return
    }
  }
  navigating.value = true
  try {
    let candidateId: string
    let isNew = false
    if (existingCandidateId.value) {
      candidateId = existingCandidateId.value
    } else if (r.type === 'teacher') {
      const res = await createCandidateFromTeacher(r.id, campaignStore.selected?.id ?? null)
      candidateId = res.id
      isNew = !res.existed
    } else {
      const res = await createCandidateFromStudent(r.id, campaignStore.selected?.id ?? null)
      candidateId = res.id
      isNew = !res.existed
    }
    // Guardar nombre del creador sin bloquear la navegación
    if (isNew && currentUserName.value) {
      supabase.from('candidates')
        .update({ created_by_name: currentUserName.value })
        .eq('id', candidateId)
        .then(() => { /* silencioso */ })
    }
    if (closeDropdown) closeSearch()
    closeModal()
    router.push({ path: `/candidates/${candidateId}`, query: isNew ? { new: '1' } : {} })
  } catch {
    toast.error('No se pudo abrir la ficha')
  } finally {
    navigating.value = false
  }
}

// Direct button click from dropdown row (bypasses preview)
async function goToFichaDirect(e: MouseEvent, r: SearchResult) {
  e.stopPropagation()
  existingCandidateId.value = r.existingId
  await goToFicha(r, true)
}

// ── Helpers ────────────────────────────────────────────────────────────────

function closeSearch() {
  query.value    = ''
  results.value  = []
  showDrop.value = false
}

const typeConfig: Record<PersonType, { label: string; dropBg: string; badgeCls: string; avatarBg: string }> = {
  student: { label: 'Alumno',  dropBg: 'hover:bg-blue-50',   badgeCls: 'bg-blue-100 text-blue-700',   avatarBg: 'bg-[#04395a]' },
  teacher: { label: 'Docente', dropBg: 'hover:bg-violet-50', badgeCls: 'bg-violet-100 text-violet-700', avatarBg: 'bg-violet-700' },
  libre:   { label: 'Libre',   dropBg: 'hover:bg-amber-50',  badgeCls: 'bg-amber-100 text-amber-700',  avatarBg: 'bg-amber-600' },
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function toProperCase(str: string) {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Keyboard & outside click ───────────────────────────────────────────────

function handleOutside(e: MouseEvent) {
  if (wrapRef.value && !wrapRef.value.contains(e.target as Node)) {
    showDrop.value = false
  }
}

function handleGlobal(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault()
    inputRef.value?.focus()
  }
  if (e.key === 'Escape') {
    if (showModal.value) closeModal()
    else closeSearch()
  }
}

const currentUserName = ref<string | null>(null)

onMounted(async () => {
  document.addEventListener('mousedown', handleOutside)
  document.addEventListener('keydown', handleGlobal)
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .maybeSingle()
      currentUserName.value = profile?.full_name ?? profile?.email ?? user.email ?? null
    }
  } catch { /* ignorar */ }
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleOutside)
  document.removeEventListener('keydown', handleGlobal)
  clearTimeout(debounce)
})
</script>

<template>
  <!-- Search wrapper -->
  <div ref="wrapRef" class="relative w-full lg:max-w-3xl">

    <!-- ── Input ─────────────────────────────────────────────────────────── -->
    <div class="relative flex items-center">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor"
        class="absolute left-3.5 w-5 h-5 text-gray-400 pointer-events-none">
        <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
      </svg>

      <input
        ref="inputRef"
        v-model="query"
        type="text"
        placeholder="Buscar candidato… (Ctrl+K)"
        @focus="query.trim().length >= 2 && (showDrop = true)"
        @keydown.escape="closeSearch"
        class="w-full pl-10 pr-8 py-4 lg:py-3 text-sm lg:text-base rounded-xl border border-gray-200 bg-gray-50
               placeholder-gray-400 text-gray-800
               focus:outline-none focus:ring-2 focus:ring-[#04395a]/30 focus:border-[#04395a]
               transition-all duration-200"
      />

      <div class="absolute right-3 flex items-center">
        <svg v-if="loading || navigating" class="w-4 h-4 text-gray-400 animate-spin"
          xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
        <button v-else-if="query" type="button" @click="closeSearch"
          class="text-gray-400 hover:text-gray-600 transition-colors" tabindex="-1">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- ── Dropdown ───────────────────────────────────────────────────────── -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-1"
    >
      <div v-if="showDrop"
        class="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50"
        style="min-width: 300px">

        <!-- No results -->
        <div v-if="!loading && results.length === 0" class="px-4 py-6 text-center text-sm text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"
            class="w-8 h-8 mx-auto mb-2 text-gray-300">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          Sin resultados para "<strong>{{ query }}</strong>"
        </div>

        <!-- Results -->
        <ul v-else class="py-1.5 max-h-80 overflow-y-auto divide-y divide-gray-50">
          <li v-for="r in results" :key="r.type + r.id">
            <!-- Row: click → preview modal -->
            <div
              :class="['flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors group', typeConfig[r.type].dropBg]"
              @click="openPreview(r)"
            >
              <!-- Avatar -->
              <div :class="['w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0', typeConfig[r.type].avatarBg]">
                {{ initials(r.full_name) }}
              </div>

              <!-- Name + meta -->
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-800 truncate group-hover:text-[#04395a] transition-colors leading-tight">
                  {{ toProperCase(r.full_name) }}
                </p>
                <p class="text-[11px] text-gray-400 truncate leading-tight">
                  DNI {{ r.dni }}<span v-if="r.campus"> · {{ r.campus }}</span>
                </p>
              </div>

              <!-- Badge (only on desktop) -->
              <span :class="['hidden lg:inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0', typeConfig[r.type].badgeCls]">
                {{ typeConfig[r.type].label }}
              </span>

              <!-- Acción directa: Editar si ya tiene ficha, Crear si no (crear solo para canWrite) -->
              <button
                v-if="r.existingId || canWrite"
                type="button"
                @click.stop="goToFichaDirect($event, r)"
                :disabled="navigating"
                :class="[
                  'hidden sm:flex shrink-0 items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap disabled:opacity-50',
                  r.existingId
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-[#04395a] text-white hover:bg-[#068ab8]',
                ]"
              >
                <!-- Editar icon -->
                <svg v-if="r.existingId" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3 h-3">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                </svg>
                <!-- Crear icon -->
                <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3 h-3">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                {{ r.existingId ? 'Editar' : 'Ficha' }}
              </button>
            </div>
          </li>
        </ul>

        <!-- Footer -->
        <div v-if="results.length > 0" class="px-4 py-2 border-t border-gray-100 bg-gray-50 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-3.5 h-3.5 text-gray-400 shrink-0">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm1.294 6.336a6.721 6.721 0 0 1-3.17.789 6.721 6.721 0 0 1-3.168-.789 3.376 3.376 0 0 1 6.338 0Z" />
          </svg>
          <p class="text-[10px] text-gray-400">Haz clic en una fila para ver detalles · <strong>Ficha</strong> para ir directo</p>
        </div>
      </div>
    </Transition>
  </div>

  <!-- ── Preview modal (Teleport to body) ──────────────────────────────────── -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="showModal && preview"
        class="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        @click.self="closeModal"
      >
        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0 scale-95 translate-y-2"
          enter-to-class="opacity-100 scale-100 translate-y-0"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100 scale-100 translate-y-0"
          leave-to-class="opacity-0 scale-95 translate-y-2"
        >
          <div v-if="showModal" class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

            <!-- Modal header -->
            <div class="flex items-center gap-4 px-6 py-5 bg-[#04395a]">
              <!-- Big avatar -->
              <div class="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white text-lg font-bold shrink-0">
                {{ initials(preview.full_name) }}
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-white font-semibold text-base leading-snug truncate">{{ toProperCase(preview.full_name) }}</p>
                <div class="flex items-center gap-2 mt-0.5">
                  <span class="text-white/70 text-xs">DNI {{ preview.dni }}</span>
                  <span :class="['text-[10px] font-bold px-2 py-0.5 rounded-full', typeConfig[preview.type].badgeCls]">
                    {{ typeConfig[preview.type].label }}
                  </span>
                </div>
              </div>
              <!-- Close -->
              <button type="button" @click="closeModal"
                class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <!-- Modal body -->
            <div class="px-6 py-5 space-y-3">
              <!-- Info grid -->
              <dl class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">

                <div v-if="preview.campus">
                  <dt class="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-0.5">Campus</dt>
                  <dd class="text-gray-800 font-medium">{{ preview.campus }}</dd>
                </div>

                <div v-if="preview.faculty">
                  <dt class="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-0.5">Facultad</dt>
                  <dd class="text-gray-800 font-medium truncate">{{ preview.faculty }}</dd>
                </div>

                <div v-if="preview.program">
                  <dt class="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-0.5">
                    {{ preview.type === 'teacher' ? 'Escuela / EP' : 'Programa' }}
                  </dt>
                  <dd class="text-gray-800 font-medium truncate">{{ preview.program }}</dd>
                </div>

                <div v-if="preview.cycle">
                  <dt class="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-0.5">
                    {{ preview.type === 'teacher' ? 'Condición' : 'Ciclo' }}
                  </dt>
                  <dd class="text-gray-800 font-medium">{{ preview.cycle }}</dd>
                </div>

                <div v-if="preview.academic_degree">
                  <dt class="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-0.5">Grado académico</dt>
                  <dd class="text-gray-800 font-medium truncate">{{ preview.academic_degree }}</dd>
                </div>

                <div v-if="preview.dedication_regime">
                  <dt class="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-0.5">Régimen</dt>
                  <dd class="text-gray-800 font-medium truncate">{{ preview.dedication_regime }}</dd>
                </div>

                <div v-if="preview.phone">
                  <dt class="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-0.5">Teléfono</dt>
                  <dd class="text-gray-800 font-medium">{{ preview.phone }}</dd>
                </div>

                <div v-if="preview.birth_date">
                  <dt class="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-0.5">Nacimiento</dt>
                  <dd class="text-gray-800 font-medium">{{ formatDate(preview.birth_date) }}</dd>
                </div>
              </dl>

              <!-- Ficha status -->
              <div class="pt-2 border-t border-gray-100">
                <div v-if="checkingCandidate" class="flex items-center gap-2 text-xs text-gray-400">
                  <svg class="w-3.5 h-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Verificando ficha existente…
                </div>
                <div v-else-if="existingCandidateId"
                  class="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 rounded-xl px-3 py-2">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4 shrink-0">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  Ya tiene una ficha de bautismo registrada
                </div>
                <div v-else
                  class="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 rounded-xl px-3 py-2">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 shrink-0">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                  Aún no tiene ficha de bautismo
                </div>
              </div>
            </div>

            <!-- Modal footer -->
            <div class="px-6 pb-5 flex gap-3">
              <button type="button" @click="closeModal"
                class="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600
                       hover:bg-gray-50 transition-colors">
                Cerrar
              </button>
              <button
                v-if="existingCandidateId || canWrite"
                type="button"
                @click="goToFicha(preview!)"
                :disabled="navigating || checkingCandidate"
                :class="[
                  'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-60',
                  existingCandidateId ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-[#04395a] hover:bg-[#068ab8]',
                ]"
              >
                <svg v-if="navigating" class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                <svg v-else-if="existingCandidateId" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178Z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                {{ existingCandidateId ? 'Ver ficha' : 'Crear ficha' }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
