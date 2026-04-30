<script setup lang="ts">
import { useRoute } from 'vue-router'
const route = useRoute()
const id = route.params['id'] as string
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center gap-3">
      <RouterLink
        to="/candidates"
        class="p-2 rounded-xl text-gray-400 hover:text-[#04395a] hover:bg-gray-100 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
      </RouterLink>
      <div>
        <h2 class="text-2xl font-bold text-[#04395a]">Ficha de Candidato</h2>
        <p class="text-xs text-gray-400 font-mono mt-0.5">{{ id }}</p>
      </div>
    </div>

    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col items-center justify-center py-24 text-center">
      <div class="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mb-3">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="#10b981" class="w-6 h-6">
          <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
      </div>
      <p class="text-sm font-semibold text-gray-700">Ficha creada exitosamente</p>
      <p class="text-xs text-gray-400 mt-1">El módulo de edición de fichas estará disponible próximamente.</p>
      <RouterLink
        to="/candidates"
        class="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[#04395a] hover:bg-[#068ab8] transition-colors"
      >
        Ver todos los candidatos
      </RouterLink>
    </div>
  </div>
</template>
