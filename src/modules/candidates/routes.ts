import type { RouteRecordRaw } from 'vue-router'

export const candidatesRoutes: RouteRecordRaw[] = [
  {
    path: 'candidates',
    name: 'candidates',
    component: () => import('@/modules/candidates/views/CandidatesView.vue'),
  },
]
