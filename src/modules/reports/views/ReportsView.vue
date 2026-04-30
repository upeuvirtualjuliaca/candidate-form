<script setup lang="ts">
import { ref } from 'vue'
import Tabs, { type Tab } from '@/components/ui/Tabs.vue'

const tabs: Tab[] = [
  { key: 'program', label: 'Por Programa' },
  { key: 'campus',  label: 'Por Sede' },
  { key: 'status',  label: 'Por Estado' },
  { key: 'export',  label: 'Exportar' },
]
const activeTab = ref('program')

function placeholder(label: string) {
  return label
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-2xl font-bold text-[#04395a]">Reportes</h2>
      <p class="text-sm text-gray-500 mt-0.5">Análisis y exportación de información del sistema.</p>
    </div>

    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="px-6 pt-4">
        <Tabs v-model="activeTab" :tabs="tabs" />
      </div>

      <div class="px-6 pb-6">

        <template v-for="tab in tabs" :key="tab.key">
          <div v-if="activeTab === tab.key">

            <!-- Export tab has a different UI -->
            <div v-if="tab.key === 'export'" class="pt-2 space-y-4">
              <p class="text-xs text-gray-400">Descarga los datos del sistema en formato Excel.</p>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  v-for="label in ['Estudiantes', 'Candidatos', 'Candidatos por Programa', 'Candidatos por Sede']"
                  :key="label"
                  type="button"
                  disabled
                  class="flex items-center gap-3 p-4 bg-gray-50 rounded-xl text-left hover:bg-[#04395a]/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div class="w-8 h-8 rounded-lg bg-[#04395a]/8 flex items-center justify-center shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="#04395a" class="w-4 h-4">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                  </div>
                  <div>
                    <p class="text-sm font-medium text-gray-700">{{ label }}</p>
                    <p class="text-xs text-gray-400">.xlsx</p>
                  </div>
                </button>
              </div>
            </div>

            <!-- All other report tabs -->
            <div v-else class="flex flex-col items-center justify-center py-20 text-center">
              <div class="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.3" stroke="#04395a" class="w-6 h-6">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                </svg>
              </div>
              <p class="text-sm font-medium text-gray-500">Reporte: {{ placeholder(tab.label) }}</p>
              <p class="text-xs text-gray-400 mt-1">Disponible cuando haya candidatos registrados.</p>
            </div>

          </div>
        </template>

      </div>
    </div>
  </div>
</template>
