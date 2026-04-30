<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/core/supabase'
import { useAuthStore } from '@/modules/auth/store/auth.store'

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

onMounted(async () => {
  if (!currentUser.value) return
  const { data } = await supabase
    .from('user_profiles')
    .select('full_name, role')
    .eq('id', currentUser.value.id)
    .single()
  if (data) profile.value = data
})

// ── Dropdown ────────────────────────────────────────────────────────────────
const open    = ref(false)
const menuRef = ref<HTMLElement | null>(null)

function toggle() { open.value = !open.value }

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
  <header class="sticky top-0 z-10 flex items-center gap-4 px-4 md:px-6 h-16 bg-white border-b border-gray-100 shadow-sm">

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
    <h1 class="text-base font-semibold text-[#04395a] tracking-tight flex-1 truncate">
      {{ pageTitle }}
    </h1>

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

        <!-- Dropdown -->
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
            class="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden z-50"
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
