<script setup lang="ts">
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-2xl font-bold text-[#04395a]">Import Students</h2>
      <p class="text-sm text-gray-500 mt-0.5">Upload an Excel file to bulk-import students.</p>
    </div>
    <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div class="border-2 border-dashed border-gray-200 rounded-xl p-12 flex flex-col items-center justify-center text-center">
        <div class="w-14 h-14 rounded-2xl bg-[#04395a]/5 flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="#04395a" class="w-7 h-7">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
          </svg>
        </div>
        <p class="text-sm font-medium text-gray-700">Drop your Excel file here</p>
        <p class="text-xs text-gray-400 mt-1">Supports .xlsx and .xls</p>
        <button
          type="button"
          class="mt-4 px-5 py-2 bg-[#04395a] text-white text-sm font-medium rounded-xl hover:bg-[#068ab8] transition-colors"
        >
          Browse file
        </button>
      </div>
    </div>
  </div>
</template>
