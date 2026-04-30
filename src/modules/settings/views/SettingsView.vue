<script setup lang="ts">
import { ref } from 'vue'
import Tabs, { type Tab } from '@/components/ui/Tabs.vue'

const tabs: Tab[] = [
  { key: 'params',   label: 'Parámetros' },
  { key: 'states',   label: 'Estados de Candidato' },
  { key: 'doctypes', label: 'Tipos de Documento' },
]
const activeTab = ref('params')
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-2xl font-bold text-[#04395a]">Configuración</h2>
      <p class="text-sm text-gray-500 mt-0.5">Parámetros generales y catálogos del sistema.</p>
    </div>

    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="px-6 pt-4">
        <Tabs v-model="activeTab" :tabs="tabs" />
      </div>

      <div class="px-6 pb-6">

        <!-- Parámetros -->
        <template v-if="activeTab === 'params'">
          <div class="pt-2 grid grid-cols-1 gap-3">
            <div v-for="param in ['Nombre del sistema', 'Correo institucional', 'Límite de importación']" :key="param"
              class="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
            >
              <div>
                <p class="text-sm font-medium text-gray-700">{{ param }}</p>
                <p class="text-xs text-gray-400 mt-0.5">—</p>
              </div>
              <button type="button" disabled class="text-xs text-[#068ab8] font-medium opacity-50">Editar</button>
            </div>
          </div>
        </template>

        <!-- Estados de Candidato -->
        <template v-if="activeTab === 'states'">
          <div class="pt-2 space-y-3">
            <div class="flex justify-end">
              <button type="button" disabled class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[#04395a] opacity-50">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Nuevo estado
              </button>
            </div>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="s in ['Borrador', 'En revisión', 'Aprobado', 'Rechazado']"
                :key="s"
                class="px-3 py-1.5 bg-gray-100 rounded-lg text-xs font-medium text-gray-600"
              >{{ s }}</span>
            </div>
          </div>
        </template>

        <!-- Tipos de Documento -->
        <template v-if="activeTab === 'doctypes'">
          <div class="pt-2 space-y-3">
            <div class="flex justify-end">
              <button type="button" disabled class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[#04395a] opacity-50">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Nuevo tipo
              </button>
            </div>
            <div class="flex flex-col items-center justify-center py-16 text-center">
              <p class="text-sm text-gray-400">Sin tipos de documento configurados.</p>
            </div>
          </div>
        </template>

      </div>
    </div>
  </div>
</template>
