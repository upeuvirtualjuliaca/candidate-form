import type { RouteRecordRaw } from 'vue-router'

export const usersRoutes: RouteRecordRaw[] = [
  {
    path: 'users',
    name: 'users',
    component: () => import('@/modules/users/views/UsersView.vue'),
  },
]
