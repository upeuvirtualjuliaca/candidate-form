import { computed } from 'vue'
import { useAuthStore } from '@/modules/auth/store/auth.store'

export function usePermissions() {
  const { currentRole } = useAuthStore()

  /** Puede crear, editar, eliminar, validar y exportar */
  const canWrite = computed(() =>
    currentRole.value === 'admin' || currentRole.value === 'recruiter',
  )

  /** Acceso completo al sistema (configuración, usuarios, etc.) */
  const canAdmin = computed(() => currentRole.value === 'admin')

  const isViewer = computed(() => currentRole.value === 'viewer')

  return { canWrite, canAdmin, isViewer }
}
