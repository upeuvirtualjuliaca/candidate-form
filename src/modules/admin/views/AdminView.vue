<script setup lang="ts">
import { ref } from 'vue'
import Tabs, { type Tab } from '@/components/ui/Tabs.vue'

const tabs: Tab[] = [
  { key: 'users',       label: 'Usuarios' },
  { key: 'roles',       label: 'Roles' },
  { key: 'permissions', label: 'Permisos' },
]
const activeTab = ref('users')
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-2xl font-bold text-[#04395a]">Administración</h2>
      <p class="text-sm text-gray-500 mt-0.5">Gestión de usuarios, roles y permisos del sistema.</p>
    </div>

    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="px-6 pt-4">
        <Tabs v-model="activeTab" :tabs="tabs" />
      </div>

      <div class="px-6 pb-6">

        <!-- Usuarios -->
        <template v-if="activeTab === 'users'">
          <div class="pt-2 space-y-3">
            <div class="flex justify-end">
              <button
                type="button"
                disabled
                class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[#04395a] hover:bg-[#068ab8] transition-colors disabled:opacity-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Nuevo usuario
              </button>
            </div>
            <div class="flex flex-col items-center justify-center py-16 text-center">
              <p class="text-sm text-gray-400">Sin usuarios registrados en el sistema.</p>
            </div>
          </div>
        </template>

        <!-- Roles -->
        <template v-if="activeTab === 'roles'">
          <div class="pt-2 space-y-3">
            <div class="flex justify-end">
              <button
                type="button"
                disabled
                class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[#04395a] hover:bg-[#068ab8] transition-colors disabled:opacity-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Nuevo rol
              </button>
            </div>
            <div class="flex flex-col items-center justify-center py-16 text-center">
              <p class="text-sm text-gray-400">Sin roles configurados.</p>
            </div>
          </div>
        </template>

        <!-- Permisos -->
        <template v-if="activeTab === 'permissions'">
          <div class="flex flex-col items-center justify-center py-20 text-center">
            <p class="text-sm text-gray-400">Configura permisos cuando haya roles creados.</p>
          </div>
        </template>

      </div>
    </div>
  </div>
</template>
