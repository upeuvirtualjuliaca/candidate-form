<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/core/supabase'
import { useAuthStore } from '@/modules/auth/store/auth.store'
import GlobalSearch from '@/components/ui/GlobalSearch.vue'
import { getCampaigns, type Campaign } from '@/modules/campaigns/services/campaigns.service'
import { useCampaignStore } from '@/modules/campaigns/store/campaign.store'

defineProps<{ sidebarOpen: boolean }>()
defineEmits<{ toggleSidebar: [] }>()

const route  = useRoute()
const router = useRouter()
const { currentUser, signOut } = useAuthStore()

// ── Page title ─────────────────────────────────────────────────────────────
const pageTitles: Record<string, string> = {
  '/':               'Dashboard',
  '/admission':      'Importar estudiantes',
  '/teachers-import':'Importar docentes',
  '/students':       'Candidatos',
  '/candidates':     'Fichas',
  '/pastors':        'Pastores',
  '/secretaries':    'Secretaría',
  '/campaigns':      'Campañas',
  '/reports':        'Reportes',
  '/admin':          'Administración',
  '/users':          'Usuarios y Accesos',
  '/settings':       'Configuración',
}
const pageTitle = computed(() => pageTitles[route.path] ?? 'Panel')

// ── User profile ────────────────────────────────────────────────────────────
const profile = ref<{ full_name: string | null; role: string } | null>(null)

const roleLabel: Record<string, string> = {
  admin:     'Administrador',
  recruiter: 'Reclutador',
  viewer:    'Visualizador',
}

const displayName = computed(() =>
  profile.value?.full_name || currentUser.value?.email || '—'
)
const displayRole = computed(() =>
  roleLabel[profile.value?.role ?? ''] ?? profile.value?.role ?? '—'
)
const initials = computed(() => {
  const name = profile.value?.full_name || currentUser.value?.email || '?'
  return name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
})

watch(currentUser, async (user) => {
  if (!user) { profile.value = null; return }
  const { data } = await supabase
    .from('user_profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()
  if (data) profile.value = data
}, { immediate: true })

// ── Campaigns selector ─────────────────────────────────────────────────────
const campaignStore = useCampaignStore()
const campaigns     = ref<Campaign[]>([])

function formatDateShort(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}

function campaignStatus(c: Campaign): 'vigente' | 'vencida' | 'pendiente' | 'inactiva' {
  if (!c.is_active) return 'inactiva'
  const t = todayIso()
  if (t < c.start_date) return 'pendiente'
  if (t > c.end_date)   return 'vencida'
  return 'vigente'
}

function statusDotClass(c: Campaign): string {
  const s = campaignStatus(c)
  if (s === 'vigente')   return 'bg-emerald-500'
  if (s === 'vencida')   return 'bg-red-400'
  if (s === 'pendiente') return 'bg-amber-400'
  return 'bg-gray-300'
}

function statusBadgeClass(c: Campaign): string {
  const s = campaignStatus(c)
  if (s === 'vigente')   return 'bg-emerald-100 text-emerald-700'
  if (s === 'vencida')   return 'bg-red-100 text-red-600'
  if (s === 'pendiente') return 'bg-amber-100 text-amber-700'
  return 'bg-gray-100 text-gray-500'
}

function statusLabelText(c: Campaign): string {
  const s = campaignStatus(c)
  if (s === 'vigente')   return 'Vigente'
  if (s === 'vencida')   return 'Vencida'
  if (s === 'pendiente') return 'Pendiente'
  return 'Inactiva'
}

const selectedStatusDotClass = computed(() => {
  if (!campaignStore.selected) return 'bg-gray-300'
  return statusDotClass(campaignStore.selected)
})

// El store ES la fuente de verdad
const selectedCampaignId = computed({
  get: () => campaignStore.selected?.id ?? '',
  set: (id: string) => {
    const found = campaigns.value.find(c => c.id === id) ?? null
    campaignStore.setSelected(found)
    if (found) {
      const status = campaignStatus(found)
      const icon   = status === 'vigente' ? '✅' : status === 'vencida' ? '⛔' : '⚠️'
      campaignStore.notify(
        `${icon} ${found.name}`,
        `Estado: ${statusLabelText(found)} · ${formatDateShort(found.start_date)} – ${formatDateShort(found.end_date)}`,
        status === 'vigente' ? 'info' : 'error',
      )
    }
  },
})

// ── Campaign custom dropdown ────────────────────────────────────────────────
const campaignDropOpen = ref(false)
const campaignSearch   = ref('')
const campaignInputRef = ref<HTMLInputElement | null>(null)

const filteredCampaigns = computed(() => {
  const q = campaignSearch.value.trim().toLowerCase()
  if (!q) return campaigns.value
  return campaigns.value.filter(c => c.name.toLowerCase().includes(q))
})

function toggleCampaignDrop(e: MouseEvent) {
  e.stopPropagation()
  campaignDropOpen.value = !campaignDropOpen.value
}

function selectCampaign(id: string) {
  selectedCampaignId.value = id
  campaignDropOpen.value = false
  campaignSearch.value = ''
}

watch(campaignDropOpen, async (val) => {
  if (val) {
    await nextTick()
    campaignInputRef.value?.focus()
  }
})

async function loadCampaigns() {
  try {
    const result = await getCampaigns(1, 100)
    campaigns.value = result.data
    const active = result.data.find(c => c.is_active) ?? result.data[0] ?? null
    campaignStore.setSelected(active)
  } catch {
    // silencioso — no bloquea el header
  }
}

onMounted(loadCampaigns)

// ── User menu dropdown ──────────────────────────────────────────────────────
const open    = ref(false)
const menuRef = ref<HTMLElement | null>(null)

function toggle() { open.value = !open.value }

// Al cerrar el menú, cerrar también el sub-dropdown de campaña
watch(open, (val) => {
  if (!val) {
    campaignDropOpen.value = false
    campaignSearch.value = ''
  }
})

function handleOutside(e: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    open.value = false
  }
}

onMounted(() => document.addEventListener('mousedown', handleOutside))
onBeforeUnmount(() => document.removeEventListener('mousedown', handleOutside))

async function handleSignOut() {
  await signOut()
  router.push('/login')
}
</script>

<template>
  <header class="sticky top-0 z-10 flex items-center gap-1 lg:gap-4 px-2 md:px-4 lg:px-6 h-20 lg:h-16 bg-white border-b border-gray-100 shadow-sm">

    <!-- Hamburger -->
    <button
      type="button"
      class="lg:hidden p-2 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-[#04395a] transition-colors"
      @click="$emit('toggleSidebar')"
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-5 h-5">
        <path v-if="sidebarOpen" stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
        <path v-else stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
      </svg>
    </button>

    <!-- Page title -->
    <h1 class="hidden lg:block text-base font-semibold text-[#04395a] tracking-tight shrink-0 truncate max-w-none">
      {{ pageTitle }}
    </h1>

    <!-- Global search -->
    <div class="flex-1 flex justify-center min-w-0 lg:px-4">
      <GlobalSearch />
    </div>

    <!-- Right -->
    <div class="flex items-center gap-3">

      <div class="hidden sm:block w-px h-6 bg-gray-200" />

      <!-- User menu -->
      <div ref="menuRef" class="relative">
        <button
          type="button"
          @click="toggle"
          class="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-gray-100 transition-colors group"
        >
          <!-- Avatar -->
          <div class="w-8 h-8 rounded-full bg-[#04395a] flex items-center justify-center text-white text-xs font-bold shrink-0">
            {{ initials }}
          </div>
          <div class="hidden sm:block leading-tight text-left">
            <p class="text-xs font-semibold text-gray-700 group-hover:text-[#04395a] transition-colors truncate max-w-[140px]">
              {{ displayName }}
            </p>
            <p class="text-[10px] text-gray-400">{{ displayRole }}</p>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"
            :class="['hidden sm:block w-3.5 h-3.5 text-gray-400 transition-transform duration-200', open ? 'rotate-180' : '']">
            <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        <!-- Dropdown panel -->
        <Transition
          enter-active-class="transition duration-150 ease-out"
          enter-from-class="opacity-0 scale-95 -translate-y-1"
          enter-to-class="opacity-100 scale-100 translate-y-0"
          leave-active-class="transition duration-100 ease-in"
          leave-from-class="opacity-100 scale-100 translate-y-0"
          leave-to-class="opacity-0 scale-95 -translate-y-1"
        >
          <div
            v-if="open"
            class="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 z-50"
          >
            <!-- User info -->
            <div class="px-4 py-4 border-b border-gray-100">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-[#04395a] flex items-center justify-center text-white text-sm font-bold shrink-0">
                  {{ initials }}
                </div>
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-gray-800 truncate">{{ displayName }}</p>
                  <span class="inline-block mt-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    :class="{
                      'bg-violet-100 text-violet-700': profile?.role === 'admin',
                      'bg-blue-100 text-blue-700':    profile?.role === 'recruiter',
                      'bg-gray-100 text-gray-600':    profile?.role === 'viewer' || !profile?.role,
                    }"
                  >
                    {{ displayRole }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Campaign selector (custom combobox) -->
            <div v-if="campaigns.length > 0" class="px-3 py-3 border-b border-gray-100">
              <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">Campaña activa</p>

              <!-- Trigger button -->
              <button
                type="button"
                @click="toggleCampaignDrop"
                class="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 hover:border-[#04395a]/40 hover:bg-[#04395a]/5 transition-all group text-left"
              >
                <!-- Status dot -->
                <span class="w-2 h-2 rounded-full shrink-0 ring-2 ring-white" :class="selectedStatusDotClass" />
                <!-- Campaign name -->
                <span class="flex-1 text-xs font-semibold text-gray-700 truncate group-hover:text-[#04395a] transition-colors">
                  {{ campaignStore.selected?.name ?? 'Seleccionar campaña' }}
                </span>
                <!-- Chevron -->
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"
                  :class="['w-3 h-3 text-gray-400 transition-transform duration-200 shrink-0', campaignDropOpen ? 'rotate-180' : '']">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              <!-- Expandable list with search -->
              <Transition
                enter-active-class="transition duration-150 ease-out"
                enter-from-class="opacity-0 -translate-y-1"
                enter-to-class="opacity-100 translate-y-0"
                leave-active-class="transition duration-100 ease-in"
                leave-from-class="opacity-100 translate-y-0"
                leave-to-class="opacity-0 -translate-y-1"
              >
                <div
                  v-if="campaignDropOpen"
                  class="mt-1.5 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden"
                  @click.stop
                >
                  <!-- Search input -->
                  <div class="p-2 border-b border-gray-100 bg-gray-50">
                    <div class="relative flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"
                        class="absolute left-2.5 w-3.5 h-3.5 text-gray-400 pointer-events-none">
                        <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                      </svg>
                      <input
                        ref="campaignInputRef"
                        v-model="campaignSearch"
                        type="text"
                        placeholder="Buscar campaña…"
                        class="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] placeholder:text-gray-400 transition-colors"
                      />
                    </div>
                  </div>

                  <!-- Campaign list -->
                  <ul class="max-h-44 overflow-y-auto divide-y divide-gray-50">
                    <li v-if="filteredCampaigns.length === 0" class="px-3 py-4 text-center text-xs text-gray-400">
                      Sin resultados
                    </li>
                    <li v-for="c in filteredCampaigns" :key="c.id">
                      <button
                        type="button"
                        @click.stop="selectCampaign(c.id)"
                        class="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-gray-50"
                        :class="c.id === campaignStore.selected?.id ? 'bg-[#04395a]/5' : ''"
                      >
                        <!-- Status dot -->
                        <span class="w-2 h-2 rounded-full shrink-0 mt-0.5" :class="statusDotClass(c)" />

                        <!-- Info -->
                        <div class="flex-1 min-w-0">
                          <p class="text-xs font-semibold text-gray-800 truncate leading-tight">
                            {{ c.name }}
                          </p>
                          <p class="text-[10px] text-gray-400 leading-tight mt-0.5">
                            {{ formatDateShort(c.start_date) }} – {{ formatDateShort(c.end_date) }}
                          </p>
                        </div>

                        <!-- Status badge -->
                        <span class="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none" :class="statusBadgeClass(c)">
                          {{ statusLabelText(c) }}
                        </span>

                        <!-- Selected check -->
                        <svg v-if="c.id === campaignStore.selected?.id"
                          xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                          stroke-width="2.5" stroke="#04395a" class="w-3.5 h-3.5 shrink-0">
                          <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      </button>
                    </li>
                  </ul>
                </div>
              </Transition>
            </div>

            <!-- Sign out -->
            <div class="p-2">
              <button
                type="button"
                @click="handleSignOut"
                class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-600 hover:bg-red-50 transition-colors font-medium"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-4 h-4 shrink-0">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                </svg>
                Cerrar sesión
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </div>

  </header>
</template>
