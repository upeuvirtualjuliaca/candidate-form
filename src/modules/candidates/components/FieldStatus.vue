<script setup lang="ts">
defineProps<{ filled: boolean }>()
</script>

<template>
  <!-- Filled: check circle verde -->
  <svg
    v-if="filled"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    class="w-3.5 h-3.5 text-emerald-500 shrink-0"
  >
    <path
      fill-rule="evenodd"
      d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
      clip-rule="evenodd"
    />
  </svg>
  <!-- Empty: minus circle gris -->
  <svg
    v-else
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    class="w-3.5 h-3.5 text-gray-300 shrink-0"
  >
    <path
      fill-rule="evenodd"
      d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM6.75 9.25a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Z"
      clip-rule="evenodd"
    />
  </svg>
</template>
