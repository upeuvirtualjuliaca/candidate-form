import { createRouter, createWebHashHistory } from 'vue-router'
import { authRoutes } from '@/modules/auth/routes'
import { usersRoutes } from '@/modules/users/routes'
import { supabase } from '@/core/supabase'
import { useAuthStore } from '@/modules/auth/store/auth.store'

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: () => import('@/layouts/MainLayout.vue'),
      children: [
        // Dashboard
        {
          path: '',
          name: 'dashboard',
          component: () => import('@/modules/dashboard/views/DashboardView.vue'),
        },

        // Admisión → tabs: Importar | Historial
        {
          path: 'admission',
          name: 'admission',
          component: () => import('@/modules/admission/views/AdmissionView.vue'),
        },
        // Legacy redirect: old /import-students → /admission
        {
          path: 'import-students',
          redirect: '/admission',
        },

        // Estudiantes → tabs: Listado | Buscar
        {
          path: 'students',
          name: 'students',
          component: () => import('@/modules/students/views/StudentsView.vue'),
        },

        // Candidatos → tabs: Listado | Nuevo | Borradores | Completados
        {
          path: 'candidates',
          name: 'candidates',
          component: () => import('@/modules/candidates/views/CandidatesView.vue'),
        },
        // Candidato detail / form
        {
          path: 'candidates/:id',
          name: 'candidate-detail',
          component: () => import('@/modules/candidates/views/CandidateFormView.vue'),
        },

        // Docentes → tabs: Importar | Historial
        {
          path: 'teachers-import',
          name: 'teachers-import',
          component: () => import('@/modules/teachers/views/TeachersImportView.vue'),
        },

        // Pastores → tabs: Listado | Nuevo | Buscar | Catálogos
        {
          path: 'pastors',
          name: 'pastors',
          component: () => import('@/modules/pastors/views/PastorsView.vue'),
        },

        // Secretaría → tabs: Listado | Nueva | Buscar
        {
          path: 'secretaries',
          name: 'secretaries',
          component: () => import('@/modules/secretaries/views/SecretariesView.vue'),
        },

        // Reportes → tabs: Por Programa | Por Sede | Por Estado | Exportar
        {
          path: 'reports',
          name: 'reports',
          component: () => import('@/modules/reports/views/ReportsView.vue'),
        },

        // Administración → tabs: Usuarios | Roles | Permisos
        {
          path: 'admin',
          name: 'admin',
          component: () => import('@/modules/admin/views/AdminView.vue'),
        },

        // Configuración → tabs: Parámetros | Estados | Tipos de Documento
        {
          path: 'settings',
          name: 'settings',
          component: () => import('@/modules/settings/views/SettingsView.vue'),
        },

        ...usersRoutes,

        {
          path: 'validation',
          name: 'validation',
          component: () => import('@/modules/validation/views/ValidationView.vue'),
        },
      ],
    },
    {
      path: '/',
      component: () => import('@/layouts/AuthLayout.vue'),
      children: [...authRoutes],
    },
  ],
})

const ADMIN_ONLY_ROUTES = new Set([
  'admission', 'teachers-import', 'pastors', 'secretaries',
  'users', 'admin', 'settings',
])

router.beforeEach(async (to) => {
  const { data } = await supabase.auth.getSession()
  const isAuth = !!data.session

  if (!isAuth && to.path !== '/login') return '/login'
  if (isAuth  && to.path === '/login') return '/'

  if (isAuth && ADMIN_ONLY_ROUTES.has(to.name as string)) {
    const { currentRole } = useAuthStore()
    // Use already-loaded role from store (no extra network call that could hang)
    if (currentRole.value !== null && currentRole.value !== 'admin') {
      return { name: 'dashboard' }
    }
  }
})

export default router
