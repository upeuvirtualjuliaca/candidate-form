<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useRoute } from 'vue-router'
import siloeLogo from '@/modules/admin/assets/siloe.png'
import iglesiaLogo from '@/modules/admin/assets/iglesia_blanco.png'
import { usePermissions } from '@/composables/usePermissions'
import { useCampaignStore } from '@/modules/campaigns/store/campaign.store'

defineProps<{ open: boolean }>()
defineEmits<{ close: [] }>()

const route = useRoute()

// ── Types ──────────────────────────────────────────────────────────────────
interface NavChild {
  name: string
  to: string
}

interface NavGroup {
  id: string
  name: string
  icon: string
  children: NavChild[]
}

interface NavSingle {
  id: string
  name: string
  to: string
  icon: string
}

type NavItem = NavSingle | NavGroup

function isGroup(item: NavItem): item is NavGroup {
  return 'children' in item
}

// ── Icons ──────────────────────────────────────────────────────────────────
const iDashboard = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 shrink-0"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" /></svg>`
const iAdmission = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 shrink-0"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" /></svg>`
const iStudents = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 shrink-0"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>`
const iCandidates = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 shrink-0"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>`
const iReports = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 shrink-0"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /></svg>`
const iAdmin = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 shrink-0"><path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" /></svg>`
const iSettings = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 shrink-0"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>`
const iPastors = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 shrink-0"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" /></svg>`
const iSecretaries = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 shrink-0"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" /></svg>`
const iUsers = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 shrink-0"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>`
const iValidation = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 shrink-0"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" /></svg>`

// ── Nav definition ─────────────────────────────────────────────────────────
const navItems: NavItem[] = [
  { id: 'dashboard', name: 'Dashboard', to: '/', icon: iDashboard },
  { id: 'users', name: 'Usuarios', to: '/users', icon: iUsers },

  {
    id: 'admission',
    name: 'Configuración',
    icon: iSettings,
    children: [
      { name: 'Estudiantes', to: '/admission' },
      { name: 'Docentes', to: '/teachers-import' },
      { name: 'Pastores', to: '/pastors' },
      { name: 'Secretaría', to: '/secretaries' },
      { name: 'Campañas', to: '/campaigns' },
    ],
  },

  {
    id: 'students',
    name: 'Listado general',
    icon: iStudents,
    children: [{ name: 'Listado', to: '/students' }],
  },

  {
    id: 'candidates',
    name: 'Fichas registradas',
    icon: iCandidates,
    children: [{ name: 'Registros', to: '/candidates' }],
  },
  { id: 'validation', name: 'Validación', to: '/validation', icon: iValidation },
  {
    id: 'reports',
    name: 'Reportes',
    icon: iReports,
    children: [{ name: 'Resumen', to: '/reports' }],
  },

  /* {
    id: 'admin',
    name: 'Administración',
    icon: iAdmin,
    children: [{ name: 'Gestión', to: '/admin' }],
  }, */

  /* {
    id: 'settings',
    name: 'Configuración',
    icon: iSettings,
    children: [{ name: 'Gestión', to: '/settings' }],
  }, */
]

const { canAdmin } = usePermissions()

// Solo admin ve: Usuarios + grupo Configuración
// Todos ven: Dashboard, Candidatos, Fichas, Validación, Reportes
const visibleNavItems = computed(() =>
  navItems.filter(item =>
    canAdmin.value || !['users', 'admission'].includes(item.id),
  ),
)

// ── Collapse state ─────────────────────────────────────────────────────────
const openGroups = ref<Set<string>>(new Set())

function toggleGroup(id: string) {
  if (openGroups.value.has(id)) {
    openGroups.value.delete(id)
  } else {
    openGroups.value.add(id)
  }
}

function isGroupOpen(id: string) {
  return openGroups.value.has(id)
}

// Auto-expand group if current route is a child
function groupHasActiveChild(item: NavGroup): boolean {
  return item.children.some((c) => route.path === c.to || route.path.startsWith(c.to + '/'))
}

function isChildActive(to: string): boolean {
  return route.path === to || route.path.startsWith(to + '/')
}

// Auto-open groups that contain the active route
function syncOpenGroups() {
  visibleNavItems.value.forEach((item) => {
    if (isGroup(item) && groupHasActiveChild(item)) {
      openGroups.value.add(item.id)
    }
  })
}

syncOpenGroups()
watch(() => route.path, syncOpenGroups)

// ── Active campaign display ────────────────────────────────────────────────
const campaignStore = useCampaignStore()

function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}

const campaignStatus = computed(() => {
  const c = campaignStore.selected
  if (!c) return null
  if (!c.is_active) return 'inactiva'
  const t = todayIso()
  if (t < c.start_date) return 'pendiente'
  if (t > c.end_date) return 'vencida'
  return 'vigente'
})

const campaignStatusLabel = computed(() => {
  const s = campaignStatus.value
  if (s === 'vigente') return 'Vigente'
  if (s === 'vencida') return 'Vencida'
  if (s === 'pendiente') return 'Pendiente'
  if (s === 'inactiva') return 'Inactiva'
  return ''
})

const campaignStatusColors = computed(() => {
  const s = campaignStatus.value
  if (s === 'vigente') return { dot: 'bg-emerald-400', badge: 'bg-emerald-400/20 text-emerald-300', ring: 'border-emerald-400/30' }
  if (s === 'vencida') return { dot: 'bg-red-400', badge: 'bg-red-400/20 text-red-300', ring: 'border-red-400/30' }
  if (s === 'pendiente') return { dot: 'bg-amber-400', badge: 'bg-amber-400/20 text-amber-300', ring: 'border-amber-400/30' }
  return { dot: 'bg-white/30', badge: 'bg-white/10 text-white/40', ring: 'border-white/10' }
})

function formatDate(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
</script>

<template>
  <!-- Mobile overlay -->
  <Transition name="fade">
    <div v-if="open" class="fixed inset-0 z-20 bg-black/50 lg:hidden" @click="$emit('close')" />
  </Transition>

  <!-- Sidebar -->
  <aside :class="[
    'fixed top-0 left-0 z-30 h-full w-64 flex flex-col',
    'bg-[#04395a] text-white shadow-2xl',
    'transition-transform duration-300 ease-in-out',
    open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
  ]">
    <!-- Logo -->
    <div class="flex items-center gap-3 px-5 py-4 border-b border-white/10 shrink-0">
      <img :src="siloeLogo" alt="Baptos" class="w-10 h-10 rounded-xl object-contain shrink-0" />
      <div class="leading-tight min-w-0">
        <p class="text-sm font-bold tracking-wide text-white truncate">BAPTOS</p>
        <p class="text-[10px] text-white/50 tracking-widest uppercase">Panel Administración</p>
      </div>
    </div>

    <!-- Nav -->
    <nav class="flex-1 overflow-y-auto px-3 py-3 space-y-0.5 scrollbar-thin">
      <template v-for="item in visibleNavItems" :key="item.id">
        <!-- Single item (Dashboard) -->
        <RouterLink v-if="!isGroup(item)" :to="(item as any).to" @click="$emit('close')" :class="[
          'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium w-full',
          'transition-all duration-200',
          route.path === (item as any).to
            ? 'bg-[#fdc710] text-[#04395a]'
            : 'text-white/70 hover:bg-[#068ab8]/60 hover:text-white',
        ]">
          <!-- eslint-disable-next-line vue/no-v-html -->
          <span v-html="item.icon" />
          <span>{{ item.name }}</span>
        </RouterLink>

        <!-- Group item -->
        <div v-else>
          <!-- Group header button -->
          <button type="button" @click="toggleGroup(item.id)" :class="[
            'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium w-full text-left',
            'transition-all duration-200',
            groupHasActiveChild(item as NavGroup)
              ? 'text-white bg-white/10'
              : 'text-white/70 hover:bg-[#068ab8]/60 hover:text-white',
          ]">
            <!-- eslint-disable-next-line vue/no-v-html -->
            <span v-html="item.icon" />
            <span class="flex-1 truncate">{{ item.name }}</span>

            <!-- Active indicator dot -->
            <span v-if="groupHasActiveChild(item as NavGroup)" class="w-1.5 h-1.5 rounded-full bg-[#fdc710] shrink-0" />

            <!-- Chevron -->
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2"
              stroke="currentColor" :class="[
                'w-3.5 h-3.5 shrink-0 transition-transform duration-300',
                isGroupOpen(item.id) ? 'rotate-180' : 'rotate-0',
              ]">
              <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          <!-- Children -->
          <div :class="[
            'overflow-hidden transition-all duration-300 ease-in-out',
            isGroupOpen(item.id) ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0',
          ]">
            <div class="mt-0.5 ml-3 pl-3 border-l border-white/10 space-y-0.5 pb-1">
              <RouterLink v-for="child in (item as NavGroup).children" :key="child.to" :to="child.to"
                @click="$emit('close')" :class="[
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium w-full',
                  'transition-all duration-200',
                  isChildActive(child.to)
                    ? 'bg-[#fdc710] text-[#04395a] font-semibold'
                    : 'text-white/60 hover:bg-[#068ab8]/60 hover:text-white',
                ]">
                <!-- Dot indicator -->
                <span :class="[
                  'w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-200',
                  isChildActive(child.to) ? 'bg-[#04395a]' : 'bg-white/30',
                ]" />
                {{ child.name }}
              </RouterLink>
            </div>
          </div>
        </div>
      </template>
    </nav>

    <!-- Campaign card -->
    <div class="px-3 pb-3 shrink-0">
      <div :class="[
        'rounded-xl border p-3 transition-all duration-300 bg-white/5',
        campaignStore.selected ? campaignStatusColors.ring : 'border-white/10',
      ]">
        <!-- Header label -->
        <div class="flex items-center gap-1.5 mb-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
            stroke="currentColor" class="w-3.5 h-3.5 text-[#fdc710] shrink-0">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 1 1 0-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 0 1-1.44-4.282m3.102.069a18.03 18.03 0 0 1-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 0 1 8.835 2.535M10.34 6.66a23.847 23.847 0 0 1 8.835-2.535m0 0A23.74 23.74 0 0 1 18.795 3m.38 1.125a23.91 23.91 0 0 1 1.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 0 0 1.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 0 1 0 3.46" />
          </svg>
          <span class="text-[9px] font-bold tracking-widest uppercase text-white/40">Campaña</span>
        </div>

        <!-- With campaign -->
        <template v-if="campaignStore.selected">
          <p class="text-white text-xs font-semibold leading-snug truncate mb-1.5">
            {{ campaignStore.selected.name }}
          </p>
          <div class="flex items-center gap-1 mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
              stroke="currentColor" class="w-3 h-3 text-white/30 shrink-0">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
            <span class="text-[10px] text-white/40">
              {{ formatDate(campaignStore.selected.start_date) }}
              <span class="text-white/20 mx-0.5">→</span>
              {{ formatDate(campaignStore.selected.end_date) }}
            </span>
          </div>
          <div class="flex items-center gap-1.5">
            <span :class="['w-1.5 h-1.5 rounded-full shrink-0', campaignStatusColors.dot]" />
            <span :class="['text-[10px] font-semibold px-1.5 py-0.5 rounded-full', campaignStatusColors.badge]">
              {{ campaignStatusLabel }}
            </span>
          </div>
        </template>

        <!-- Without campaign -->
        <template v-else>
          <p class="text-white/30 text-[10px] leading-snug">
            Sin campaña seleccionada.<br>
            <span class="text-white/20">Elige una desde el encabezado.</span>
          </p>
        </template>
      </div>
    </div>

    <!-- Footer -->
    <div class="px-5 py-3 border-t border-white/10 shrink-0 flex items-center justify-center">
      <img :src="iglesiaLogo" alt="Iglesia Adventista" class="w-28 h-28 object-contain opacity-30" />
    </div>
  </aside>
</template>

<style scoped>
/* Thin scrollbar for nav */
.scrollbar-thin {
  scrollbar-width: thin;
  scrollbar-color: rgba(255 255 255 / 0.15) transparent;
}

.scrollbar-thin::-webkit-scrollbar {
  width: 4px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background: rgba(255 255 255 / 0.15);
  border-radius: 99px;
}

/* Fade transition for overlay */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
