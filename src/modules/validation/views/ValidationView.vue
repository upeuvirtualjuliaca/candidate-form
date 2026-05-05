<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { supabase } from '@/core/supabase'
import { useToastStore } from '@/stores/toast'
import { usePermissions } from '@/composables/usePermissions'
import { useAuthStore } from '@/modules/auth/store/auth.store'

const toast = useToastStore()
const { canWrite } = usePermissions()
const { currentUser } = useAuthStore()

const validatorName = ref<string | null>(null)

// ── Types ──────────────────────────────────────────────────────────────────

interface Candidate {
  id:                  string
  ceremony_completed:  boolean | null
  created_at:          string
  validated_by_name:   string | null
  validated_at:        string | null
  students: {
    full_name: string | null
    dni:       string | null
    phone:     string | null
    campus:    string | null
    faculty:   string | null
    program:   string | null
  } | null
  teachers: {
    full_name: string | null
    dni:       string | null
    campus:    string | null
    faculty:   string | null
    main_ep:   string | null
  } | null
}

// ── Tabs ───────────────────────────────────────────────────────────────────

type TabKey = 'validate' | 'baptized'
const activeTab = ref<TabKey>('validate')

// ── State ──────────────────────────────────────────────────────────────────

const loading         = ref(false)
const loadingBaptized = ref(false)
const todayCandidates = ref<Candidate[]>([])
const allBaptized     = ref<Candidate[]>([])
const validating      = ref<Set<string>>(new Set())
const searchToday     = ref('')
const searchBaptized  = ref('')

const selectedDate = ref(new Date().toISOString().slice(0, 10))

const selectedDateLabel = computed(() => {
  const parts = selectedDate.value.split('-')
  const y = parseInt(parts[0]!), m = parseInt(parts[1]!), d = parseInt(parts[2]!)
  return new Date(y, m - 1, d).toLocaleDateString('es-PE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
})

// ── Turnos ─────────────────────────────────────────────────────────────────

type ShiftKey = 't1' | 't2' | 't3' | 'none'

function getShift(validatedAt: string | null): ShiftKey {
  if (!validatedAt) return 'none'
  const d = new Date(validatedAt)
  const total = d.getHours() * 60 + d.getMinutes()
  if (total >= 8 * 60 + 45  && total < 11 * 60 + 0)  return 't1'
  if (total >= 11 * 60 + 0  && total < 13 * 60 + 0)  return 't2'
  if (total >= 15 * 60 + 10 && total < 18 * 60 + 0)  return 't3'
  return 'none'
}

const SHIFT_STYLES: Record<ShiftKey, {
  card:      string
  avatar:    string
  badge:     string
  numBadge:  string
  label:     string
  validator: string
}> = {
  t1:   { card: 'border-sky-200 bg-gradient-to-br from-white to-sky-50/60',      avatar: 'bg-sky-500',     badge: 'text-sky-600 bg-sky-100',       numBadge: 'text-sky-600 bg-sky-100',     label: 'Turno 1',     validator: '#0ea5e9' },
  t2:   { card: 'border-violet-200 bg-gradient-to-br from-white to-violet-50/60', avatar: 'bg-violet-500',  badge: 'text-violet-600 bg-violet-100',  numBadge: 'text-violet-600 bg-violet-100', label: 'Turno 2',   validator: '#7c3aed' },
  t3:   { card: 'border-amber-200 bg-gradient-to-br from-white to-amber-50/60',   avatar: 'bg-amber-500',   badge: 'text-amber-600 bg-amber-100',    numBadge: 'text-amber-600 bg-amber-100',  label: 'Turno Tarde', validator: '#d97706' },
  none: { card: 'border-emerald-200 bg-gradient-to-br from-white to-emerald-50/50', avatar: 'bg-emerald-500', badge: 'text-emerald-600 bg-emerald-100', numBadge: 'text-emerald-600 bg-emerald-100', label: '', validator: '#10b981' },
}

// ── Helpers ────────────────────────────────────────────────────────────────

function name(c: Candidate)    { return c.students?.full_name ?? c.teachers?.full_name ?? 'Sin nombre' }
function dni(c: Candidate)     { return c.students?.dni ?? c.teachers?.dni ?? '—' }
function phone(c: Candidate)   { return c.students?.phone ?? '—' }
function campus(c: Candidate)  { return c.students?.campus ?? c.teachers?.campus ?? '—' }
function program(c: Candidate) { return c.students?.program ?? c.teachers?.main_ep ?? '—' }
function personType(c: Candidate) {
  if (c.students) return 'Alumno'
  if (c.teachers) return 'Docente'
  return 'Libre'
}
function initials(c: Candidate) {
  return name(c).split(' ').slice(0, 2).map((w: string) => w[0] ?? '').join('').toUpperCase()
}
function toProperCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

function matchesSearch(c: Candidate, q: string) {
  if (!q.trim()) return true
  const s = q.toLowerCase()
  return name(c).toLowerCase().includes(s) || dni(c).toLowerCase().includes(s)
}

// ── Computed filtered lists ────────────────────────────────────────────────

const filteredToday = computed(() =>
  todayCandidates.value.filter(c => !c.ceremony_completed && matchesSearch(c, searchToday.value))
)
const filteredBaptized = computed(() =>
  allBaptized.value.filter(c => matchesSearch(c, searchBaptized.value))
)

// Summary (always from full list, not filtered)
const totalHoy      = computed(() => todayCandidates.value.length)
const bautizadosHoy = computed(() => todayCandidates.value.filter(c => !!c.ceremony_completed).length)
const pendientesHoy = computed(() => todayCandidates.value.filter(c => !c.ceremony_completed).length)

// ── Data loaders ───────────────────────────────────────────────────────────

async function loadToday() {
  loading.value = true
  try {
    const parts = selectedDate.value.split('-')
    const y = parseInt(parts[0]!), m = parseInt(parts[1]!), d = parseInt(parts[2]!)
    const start = new Date(y, m - 1, d, 0, 0, 0, 0)
    const end   = new Date(y, m - 1, d, 23, 59, 59, 999)
    const { data, error } = await supabase
      .from('candidates')
      .select(`id, ceremony_completed, created_at,
        students ( full_name, dni, phone, campus, faculty, program ),
        teachers ( full_name, dni, campus, faculty, main_ep )`)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: true })
    if (error) throw error
    todayCandidates.value = (data ?? []) as unknown as Candidate[]
  } finally {
    loading.value = false
  }
}

async function loadBaptized() {
  loadingBaptized.value = true
  try {
    const parts = selectedDate.value.split('-')
    const y = parseInt(parts[0]!), m = parseInt(parts[1]!), d = parseInt(parts[2]!)
    const start = new Date(y, m - 1, d, 0, 0, 0, 0)
    const end   = new Date(y, m - 1, d, 23, 59, 59, 999)
    const { data, error } = await supabase
      .from('candidates')
      .select(`id, ceremony_completed, created_at, validated_by_name, validated_at,
        students ( full_name, dni, phone, campus, faculty, program ),
        teachers ( full_name, dni, campus, faculty, main_ep )`)
      .eq('ceremony_completed', true)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: false })
    if (error) throw error
    allBaptized.value = (data ?? []) as unknown as Candidate[]
  } finally {
    loadingBaptized.value = false
  }
}

const baptizedLoaded = ref(false)

function switchTab(tab: TabKey) {
  activeTab.value = tab
  if (tab === 'baptized' && !baptizedLoaded.value && !loadingBaptized.value) {
    baptizedLoaded.value = true
    loadBaptized()
  }
}

// ── Mark baptized ──────────────────────────────────────────────────────────

async function markBaptized(c: Candidate) {
  if (c.ceremony_completed) return
  validating.value.add(c.id)
  try {
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('candidates')
      .update({ ceremony_completed: true, validated_by_name: validatorName.value, validated_at: now })
      .eq('id', c.id)
    if (error) throw error
    toast.success(`✓ ${name(c)} ingresó al tanque de bautismo`)
    c.ceremony_completed = true
    c.validated_by_name  = validatorName.value
    c.validated_at       = now
    allBaptized.value.unshift({ ...c })
    baptizedLoaded.value = true
  } catch {
    toast.error('Error al actualizar el estado. Intenta de nuevo.')
  } finally {
    validating.value.delete(c.id)
  }
}

watch(selectedDate, () => {
  todayCandidates.value = []
  allBaptized.value     = []
  baptizedLoaded.value  = false
  searchToday.value     = ''
  searchBaptized.value  = ''
  loadToday()
  if (activeTab.value === 'baptized') loadBaptized()
})

onMounted(async () => {
  loadToday()
  if (currentUser.value) {
    const { data } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('id', currentUser.value.id)
      .single()
    validatorName.value = data?.full_name ?? currentUser.value.email ?? null
  }
})
</script>

<template>
  <div class="space-y-5">

    <!-- ── Header ─────────────────────────────────────────────────────────── -->
    <div class="flex items-center justify-between gap-4 flex-wrap">
      <div>
        <h2 class="text-2xl font-bold text-[#04395a]">Validación</h2>
        <p class="text-sm text-gray-500 mt-0.5 capitalize">{{ selectedDateLabel }}</p>
      </div>
      <div class="flex items-center gap-2">
        <!-- Date picker -->
        <div class="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm hover:border-[#068ab8] transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            stroke-width="1.8" stroke="#068ab8" class="w-4 h-4 shrink-0 pointer-events-none">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
          </svg>
          <input
            type="date"
            v-model="selectedDate"
            class="text-sm font-medium text-[#04395a] bg-transparent focus:outline-none cursor-pointer"
          />
        </div>
        <!-- Refresh -->
        <button type="button" @click="activeTab === 'validate' ? loadToday() : loadBaptized()"
          class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-[#04395a] text-white hover:bg-[#068ab8] transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            stroke-width="2" stroke="currentColor" class="w-4 h-4"
            :class="(loading || loadingBaptized) && 'animate-spin'">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Actualizar
        </button>
      </div>
    </div>

    <!-- ── Summary cards (only on validate tab) ───────────────────────────── -->
    <template v-if="activeTab === 'validate'">
      <div class="grid grid-cols-3 gap-3">
        <div class="rounded-2xl border border-[#04395a]/10 bg-gradient-to-br from-[#04395a] to-[#068ab8] text-white p-4 text-center">
          <p class="text-3xl font-bold">{{ totalHoy }}</p>
          <p class="text-xs text-white/70 mt-0.5">Total</p>
        </div>
        <div class="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-center">
          <p class="text-3xl font-bold text-emerald-700">{{ bautizadosHoy }}</p>
          <p class="text-xs text-emerald-600/70 mt-0.5">Bautizados</p>
        </div>
        <div class="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-center">
          <p class="text-3xl font-bold text-amber-700">{{ pendientesHoy }}</p>
          <p class="text-xs text-amber-600/70 mt-0.5">Pendientes</p>
        </div>
      </div>
    </template>

    <!-- ── Tab bar ────────────────────────────────────────────────────────── -->
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

      <!-- Tab headers -->
      <div class="flex border-b border-gray-100">
        <button type="button"
          @click="switchTab('validate')"
          class="flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-colors"
          :class="activeTab === 'validate'
            ? 'text-[#04395a] border-b-2 border-[#04395a] bg-[#04395a]/3'
            : 'text-gray-400 hover:text-gray-600'">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            stroke-width="1.8" stroke="currentColor" class="w-4 h-4">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
          </svg>
          Validación
          <span class="px-2 py-0.5 rounded-full text-xs font-bold"
            :class="activeTab === 'validate' ? 'bg-[#04395a] text-white' : 'bg-gray-100 text-gray-500'">
            {{ pendientesHoy }}
          </span>
        </button>

        <button type="button"
          @click="switchTab('baptized')"
          class="flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-colors"
          :class="activeTab === 'baptized'
            ? 'text-emerald-600 border-b-2 border-emerald-500 bg-emerald-50/50'
            : 'text-gray-400 hover:text-gray-600'">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            stroke-width="1.8" stroke="currentColor" class="w-4 h-4">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          Bautizados
          <span class="px-2 py-0.5 rounded-full text-xs font-bold"
            :class="activeTab === 'baptized' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'">
            {{ allBaptized.length }}
          </span>
        </button>
      </div>

      <div class="p-4 space-y-4">

        <!-- ══ TAB: VALIDACIÓN ══════════════════════════════════════════════ -->
        <template v-if="activeTab === 'validate'">

          <!-- Search box -->
          <div class="relative group">
            <div class="absolute inset-0 rounded-2xl bg-gradient-to-r from-[#04395a]/20 to-[#068ab8]/20 blur-sm opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 pointer-events-none" />
            <div class="relative flex items-center bg-white rounded-2xl shadow-sm border border-gray-200 group-focus-within:border-[#04395a]/40 transition-colors duration-200 overflow-hidden">
              <div class="pl-4 pr-2 shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                  stroke-width="2" class="w-5 h-5 transition-colors duration-200"
                  :stroke="searchToday ? '#04395a' : '#d1d5db'">
                  <path stroke-linecap="round" stroke-linejoin="round"
                    d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
              </div>
              <input
                v-model="searchToday"
                type="text"
                placeholder="Buscar por nombre o DNI…"
                class="flex-1 py-4 pr-4 text-sm bg-transparent focus:outline-none placeholder:text-gray-300 text-gray-800 font-medium"
              />
              <transition name="fade">
                <button v-if="searchToday" @click="searchToday = ''"
                  class="mr-3 w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center shrink-0 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                    stroke-width="2.5" stroke="#6b7280" class="w-3 h-3">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </transition>
            </div>
          </div>

          <!-- Skeleton -->
          <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div v-for="i in 6" :key="i" class="h-44 rounded-2xl bg-gray-100 animate-pulse"
              :style="{ opacity: 1 - i * 0.1 }" />
          </div>

          <!-- Empty state -->
          <div v-else-if="filteredToday.length === 0"
            class="flex flex-col items-center justify-center py-20 text-center">
            <div class="w-14 h-14 rounded-2xl bg-[#04395a]/5 flex items-center justify-center mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                stroke-width="1.2" stroke="#04395a" class="w-7 h-7">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
              </svg>
            </div>
            <p class="text-sm font-semibold text-gray-600">
              {{ searchToday ? 'Sin resultados' : 'Sin candidatos hoy' }}
            </p>
            <p class="text-xs text-gray-400 mt-1">
              {{ searchToday ? 'Intenta con otro nombre o DNI.' : 'No hay fichas registradas para hoy.' }}
            </p>
          </div>

          <!-- Cards grid -->
          <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div v-for="c in filteredToday" :key="c.id"
              class="relative rounded-2xl border-2 overflow-hidden transition-all duration-300 select-none border-gray-200 bg-white hover:border-[#068ab8]/50 hover:shadow-lg hover:shadow-[#04395a]/8 cursor-pointer active:scale-[0.98]"
              @click="markBaptized(c)">


              <!-- Loading overlay -->
              <div v-if="validating.has(c.id)"
                class="absolute inset-0 bg-white/70 flex items-center justify-center z-10 rounded-2xl">
                <svg class="animate-spin w-7 h-7 text-[#04395a]" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              </div>

              <div class="p-4">
                <!-- Avatar + name -->
                <div class="flex items-center gap-3 mb-3">
                  <div class="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-sm font-bold bg-[#04395a] text-white">
                    {{ initials(c) }}
                  </div>
                  <div class="min-w-0">
                    <p class="text-sm font-semibold text-gray-800 leading-tight truncate">{{ toProperCase(name(c)) }}</p>
                    <p class="text-xs text-gray-400 font-mono mt-0.5">{{ dni(c) }}</p>
                  </div>
                </div>
                <!-- Info -->
                <div class="space-y-1.5 mb-4">
                  <div class="flex items-center gap-2">
                    <span class="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                      :class="{
                        'bg-blue-100 text-blue-700':     !!c.students,
                        'bg-purple-100 text-purple-700': !!c.teachers && !c.students,
                        'bg-gray-100 text-gray-600':     !c.students && !c.teachers,
                      }">{{ personType(c) }}</span>
                    <span v-if="phone(c) !== '—'" class="text-xs text-gray-500 truncate">📞 {{ phone(c) }}</span>
                  </div>
                  <p v-if="campus(c) !== '—'" class="text-xs text-gray-500 flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                      stroke-width="1.5" stroke="#9ca3af" class="w-3.5 h-3.5 shrink-0">
                      <path stroke-linecap="round" stroke-linejoin="round"
                        d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>
                      <path stroke-linecap="round" stroke-linejoin="round"
                        d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"/>
                    </svg>
                    {{ campus(c) }}
                  </p>
                  <p v-if="program(c) !== '—'" class="text-xs text-gray-400 truncate pl-5">{{ program(c) }}</p>
                </div>
                <!-- Action button -->
                <button v-if="canWrite" type="button"
                  class="w-full py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-2 bg-[#04395a] text-white hover:bg-[#068ab8] active:scale-95"
                  :disabled="validating.has(c.id)"
                  @click.stop="markBaptized(c)">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none"
                    viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-3.5 h-3.5">
                    <path stroke-linecap="round" stroke-linejoin="round"
                      d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"/>
                  </svg>
                  Ingresar al tanque
                </button>
              </div>
            </div>
          </div>

        </template>

        <!-- ══ TAB: BAUTIZADOS ══════════════════════════════════════════════ -->
        <template v-else>

          <!-- Search box -->
          <div class="relative group">
            <div class="absolute inset-0 rounded-2xl bg-gradient-to-r from-emerald-400/20 to-teal-400/20 blur-sm opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 pointer-events-none" />
            <div class="relative flex items-center bg-white rounded-2xl shadow-sm border border-gray-200 group-focus-within:border-emerald-400/50 transition-colors duration-200 overflow-hidden">
              <div class="pl-4 pr-2 shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                  stroke-width="2" class="w-5 h-5 transition-colors duration-200"
                  :stroke="searchBaptized ? '#10b981' : '#d1d5db'">
                  <path stroke-linecap="round" stroke-linejoin="round"
                    d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
              </div>
              <input
                v-model="searchBaptized"
                type="text"
                placeholder="Buscar por nombre o DNI…"
                class="flex-1 py-4 pr-4 text-sm bg-transparent focus:outline-none placeholder:text-gray-300 text-gray-800 font-medium"
              />
              <transition name="fade">
                <button v-if="searchBaptized" @click="searchBaptized = ''"
                  class="mr-3 w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center shrink-0 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                    stroke-width="2.5" stroke="#6b7280" class="w-3 h-3">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/>
                  </svg>
                </button>
              </transition>
            </div>
          </div>

          <!-- Skeleton -->
          <div v-if="loadingBaptized" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div v-for="i in 6" :key="i" class="h-36 rounded-2xl bg-gray-100 animate-pulse"
              :style="{ opacity: 1 - i * 0.1 }"/>
          </div>

          <!-- Empty -->
          <div v-else-if="filteredBaptized.length === 0"
            class="flex flex-col items-center justify-center py-20 text-center">
            <div class="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                stroke-width="1.2" stroke="#10b981" class="w-7 h-7">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
              </svg>
            </div>
            <p class="text-sm font-semibold text-gray-600">
              {{ searchBaptized ? 'Sin resultados' : 'Aún no hay bautizados' }}
            </p>
            <p class="text-xs text-gray-400 mt-1">
              {{ searchBaptized ? 'Intenta con otro nombre o DNI.' : 'Los candidatos bautizados aparecerán aquí.' }}
            </p>
          </div>

          <!-- Cards grid -->
          <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div v-for="(c, i) in filteredBaptized" :key="c.id"
              :class="['rounded-2xl border p-4 shadow-sm', SHIFT_STYLES[getShift(c.validated_at)].card]">
              <!-- Number badge + turno -->
              <div class="flex items-start justify-between mb-3">
                <div class="flex items-center gap-3 min-w-0 flex-1">
                  <div :class="['w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0', SHIFT_STYLES[getShift(c.validated_at)].avatar]">
                    {{ initials(c) }}
                  </div>
                  <div class="min-w-0">
                    <p class="text-sm font-semibold text-gray-800 leading-tight truncate">{{ toProperCase(name(c)) }}</p>
                    <p class="text-xs text-gray-400 font-mono mt-0.5">{{ dni(c) }}</p>
                  </div>
                </div>
                <div class="flex flex-col items-end gap-1 shrink-0">
                  <span :class="['text-xs font-bold px-2 py-0.5 rounded-full', SHIFT_STYLES[getShift(c.validated_at)].numBadge]">
                    #{{ i + 1 }}
                  </span>
                </div>
              </div>
              <!-- Info -->
              <div class="space-y-1 mb-3">
                <div class="flex items-center gap-2">
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                    :class="{
                      'bg-blue-100 text-blue-700':     !!c.students,
                      'bg-purple-100 text-purple-700': !!c.teachers && !c.students,
                      'bg-gray-100 text-gray-600':     !c.students && !c.teachers,
                    }">{{ personType(c) }}</span>
                  <span v-if="phone(c) !== '—'" class="text-xs text-gray-500 truncate">📞 {{ phone(c) }}</span>
                </div>
                <p v-if="campus(c) !== '—'" class="text-xs text-gray-500 truncate">📍 {{ campus(c) }}</p>
                <p v-if="program(c) !== '—'" class="text-xs text-gray-400 truncate pl-5">{{ program(c) }}</p>
              </div>
              <!-- Footer: validator + turno + hora -->
              <div class="flex items-end justify-between gap-2 mt-1">
                <div v-if="c.validated_by_name" class="flex items-center gap-1 min-w-0">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                    stroke-width="1.8" :stroke="SHIFT_STYLES[getShift(c.validated_at)].validator" class="w-3 h-3 shrink-0">
                    <path stroke-linecap="round" stroke-linejoin="round"
                      d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                  <span :style="{ color: SHIFT_STYLES[getShift(c.validated_at)].validator }"
                    class="text-[10px] font-medium truncate">{{ c.validated_by_name }}</span>
                </div>
                <div v-else class="flex-1" />
                <div class="flex flex-col items-end shrink-0">
                  <span v-if="SHIFT_STYLES[getShift(c.validated_at)].label"
                    :class="['text-[10px] font-semibold px-2 py-0.5 rounded-full mb-0.5', SHIFT_STYLES[getShift(c.validated_at)].badge]">
                    {{ SHIFT_STYLES[getShift(c.validated_at)].label }}
                  </span>
                  <p class="text-[10px] text-gray-400">
                    {{ c.validated_at
                      ? new Date(c.validated_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
                      : new Date(c.created_at).toLocaleDateString('es-PE', { day:'2-digit', month:'short' }) }}
                  </p>
                </div>
              </div>
            </div>
          </div>

        </template>
      </div>
    </div>

  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.fade-enter-from,
.fade-leave-to    { opacity: 0; transform: scale(0.8); }
</style>
