<script setup lang="ts">
// Wrapper for main content area — provides consistent padding and scroll
</script>

<template>
  <main class="flex-1 overflow-y-auto">
    <div class="p-4 md:p-6 lg:p-8">
      <slot />
    </div>
  </main>
</template>
