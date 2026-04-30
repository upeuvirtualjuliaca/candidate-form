import type { RouteRecordRaw } from 'vue-router'

export const authRoutes: RouteRecordRaw[] = [
  {
    path: 'login',
    name: 'login',
    component: () => import('@/modules/auth/views/LoginView.vue'),
  },
]
