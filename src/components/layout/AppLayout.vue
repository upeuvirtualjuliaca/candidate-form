<script setup lang="ts">
import { ref } from 'vue'
import AppSidebar from './AppSidebar.vue'
import AppHeader from './AppHeader.vue'
import AppContent from './AppContent.vue'

const sidebarOpen = ref(false)

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
}

function closeSidebar() {
  sidebarOpen.value = false
}
</script>

<template>
  <div class="flex h-screen bg-gray-50 overflow-hidden">
    <!-- Sidebar -->
    <AppSidebar :open="sidebarOpen" @close="closeSidebar" />

    <!-- Main area: offset by sidebar width on lg+ -->
    <div class="flex flex-col flex-1 min-w-0 lg:ml-64 transition-all duration-300">
      <AppHeader :sidebar-open="sidebarOpen" @toggle-sidebar="toggleSidebar" />
      <AppContent>
        <slot />
      </AppContent>
    </div>
  </div>
</template>
