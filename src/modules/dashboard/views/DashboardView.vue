<script setup lang="ts">
const stats = [
  { label: 'Total Students', value: '0', icon: 'students', color: 'bg-[#04395a]' },
  { label: 'Candidates', value: '0', icon: 'candidates', color: 'bg-[#068ab8]' },
  { label: 'Pending Review', value: '0', icon: 'pending', color: 'bg-[#fdc710]' },
  { label: 'Approved', value: '0', icon: 'approved', color: 'bg-emerald-500' },
]
</script>

<template>
  <div class="space-y-6">
    <!-- Page heading -->
    <div>
      <h2 class="text-2xl font-bold text-[#04395a]">Welcome back</h2>
      <p class="text-sm text-gray-500 mt-0.5">Here's an overview of the system activity.</p>
    </div>

    <!-- Stats grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <div
        v-for="stat in stats"
        :key="stat.label"
        class="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4"
      >
        <div :class="[stat.color, 'w-11 h-11 rounded-xl flex items-center justify-center shrink-0']">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="white" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
          </svg>
        </div>
        <div>
          <p class="text-2xl font-bold text-gray-800">{{ stat.value }}</p>
          <p class="text-xs text-gray-500 mt-0.5">{{ stat.label }}</p>
        </div>
      </div>
    </div>

    <!-- Placeholder content area -->
    <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <h3 class="text-sm font-semibold text-gray-700 mb-4">Recent Activity</h3>
      <div class="flex flex-col items-center justify-center py-16 text-center">
        <div class="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.2" stroke="#04395a" class="w-7 h-7">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
          </svg>
        </div>
        <p class="text-sm text-gray-400">No activity yet. Start by importing students.</p>
      </div>
    </div>
  </div>
</template>
