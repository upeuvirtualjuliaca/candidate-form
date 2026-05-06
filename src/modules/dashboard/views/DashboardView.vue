<script setup lang="ts">
import { ref, computed, onMounted, type Ref } from 'vue'
import { supabase } from '@/core/supabase'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Bar } from 'vue-chartjs'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend, Filler)

// ── Counters ────────────────────────────────────────────────────────────────
const totalUsuarios        = ref(0)
const fichasGeneradas      = ref(0)
const bautizados           = ref(0)
const pendientes           = ref(0)
const bautismosConfirmados = ref(0)

// ── Chart data ───────────────────────────────────────────────────────────────
interface DayBucket { label: string; total: number; completed: number; draft: number }
const chartBuckets = ref<DayBucket[]>([])

const chartData = computed(() => ({
  labels: chartBuckets.value.map(b => b.label),
  datasets: [
    {
      label: 'Fichas generadas',
      data: chartBuckets.value.map(b => b.total),
      backgroundColor: 'rgba(6, 138, 184, 0.85)',
      borderRadius: 6,
      borderSkipped: false,
    },
    {
      label: 'Fichas completadas',
      data: chartBuckets.value.map(b => b.completed),
      backgroundColor: 'rgba(16, 185, 129, 0.85)',
      borderRadius: 6,
      borderSkipped: false,
    },
    {
      label: 'Fichas por completar',
      data: chartBuckets.value.map(b => b.draft),
      backgroundColor: 'rgba(251, 146, 60, 0.85)',
      borderRadius: 6,
      borderSkipped: false,
    },
  ],
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 800, easing: 'easeOutQuart' as const },
  plugins: {
    legend: {
      position: 'top' as const,
      labels: {
        usePointStyle: true,
        pointStyle: 'circle',
        padding: 20,
        font: { size: 12, family: 'inherit' },
        color: '#6b7280',
      },
    },
    tooltip: {
      backgroundColor: '#1f2937',
      titleColor: '#f9fafb',
      bodyColor: '#d1d5db',
      padding: 12,
      cornerRadius: 10,
      callbacks: {
        label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) =>
          `  ${ctx.dataset.label}: ${ctx.parsed.y ?? 0}`,
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: '#9ca3af', font: { size: 11 } },
      border: { display: false },
    },
    y: {
      beginAtZero: true,
      grid: { color: 'rgba(0,0,0,0.05)' },
      ticks: { color: '#9ca3af', font: { size: 11 }, precision: 0 },
      border: { display: false },
    },
  },
}

// ── Easing counter animation ────────────────────────────────────────────────
function animateTo(target: Ref<number>, finalValue: number) {
  if (finalValue === 0) return
  const duration = 1800
  const start    = performance.now()
  function tick(now: number) {
    const elapsed  = now - start
    const progress = Math.min(elapsed / duration, 1)
    const eased    = 1 - Math.pow(1 - progress, 3)
    target.value   = Math.round(eased * finalValue)
    if (progress < 1) requestAnimationFrame(tick)
    else target.value = finalValue
  }
  requestAnimationFrame(tick)
}

// ── Data fetch ───────────────────────────────────────────────────────────────
onMounted(async () => {
  const [candidatesRes, studentsRes, teachersRes] = await Promise.all([
    supabase.from('candidates').select('id, status, student_id, teacher_id, created_at, ceremony_completed'),
    supabase.from('students').select('id', { count: 'exact', head: true }),
    supabase.from('teachers').select('id', { count: 'exact', head: true }),
  ])

  const candidates = candidatesRes.data ?? []

  // ── Summary counters
  const totalCompleted  = candidates.filter(c => c.status === 'completed').length
  const totalDraft      = candidates.filter(c => c.status === 'draft').length
  const totalCandidates = candidates.length
  const libres          = candidates.filter(c => !c.student_id && !c.teacher_id).length
  const totalUsers      = (studentsRes.count ?? 0) + (teachersRes.count ?? 0) + libres

  const totalBautismos = candidates.filter(c => c.ceremony_completed === true).length

  animateTo(totalUsuarios,        totalUsers)
  animateTo(fichasGeneradas,      totalCandidates)
  animateTo(bautizados,           totalCompleted)
  animateTo(pendientes,           totalDraft)
  animateTo(bautismosConfirmados, totalBautismos)

  // ── Build monthly buckets (all time)
  const bucketMap = new Map<string, DayBucket>()
  for (const c of candidates) {
    const key = (c.created_at as string).slice(0, 7) // YYYY-MM
    if (!bucketMap.has(key)) {
      const [y, m] = key.split('-')
      const label  = new Date(Number(y), Number(m) - 1, 1)
        .toLocaleDateString('es-PE', { month: 'short', year: 'numeric' })
      bucketMap.set(key, { label, total: 0, completed: 0, draft: 0 })
    }
    const b = bucketMap.get(key)!
    b.total++
    if (c.status === 'completed') b.completed++
    else b.draft++
  }
  // Sort chronologically
  chartBuckets.value = Array.from(bucketMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v)
})
</script>

<template>
  <div class="space-y-6">
    <!-- Page heading -->
    <div>
      <h2 class="text-2xl font-bold text-[#04395a]">Panel de control</h2>
      <p class="text-sm text-gray-500 mt-0.5">Resumen general del sistema de registro.</p>
    </div>

    <!-- Stats grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">

      <!-- Total Usuarios -->
      <div class="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
        <div class="w-11 h-11 rounded-xl bg-[#04395a] flex items-center justify-center shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            stroke-width="1.5" stroke="white" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
          </svg>
        </div>
        <div>
          <p class="text-2xl font-bold text-gray-800 tabular-nums">{{ totalUsuarios.toLocaleString() }}</p>
          <p class="text-xs text-gray-500 mt-0.5 uppercase tracking-wide font-medium">Total Usuarios</p>
        </div>
      </div>

      <!-- Fichas Generadas -->
      <div class="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
        <div class="w-11 h-11 rounded-xl bg-[#068ab8] flex items-center justify-center shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            stroke-width="1.5" stroke="white" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
        </div>
        <div>
          <p class="text-2xl font-bold text-gray-800 tabular-nums">{{ fichasGeneradas.toLocaleString() }}</p>
          <p class="text-xs text-gray-500 mt-0.5 uppercase tracking-wide font-medium">Fichas Generadas</p>
        </div>
      </div>

      <!-- Fichas Completadas -->
      <div class="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
        <div class="w-11 h-11 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            stroke-width="1.5" stroke="white" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </div>
        <div>
          <p class="text-2xl font-bold text-gray-800 tabular-nums">{{ bautizados.toLocaleString() }}</p>
          <p class="text-xs text-gray-500 mt-0.5 uppercase tracking-wide font-medium">Fichas completadas</p>
        </div>
      </div>

      <!-- Fichas por Completar -->
      <div class="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
        <div class="w-11 h-11 rounded-xl bg-amber-400 flex items-center justify-center shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            stroke-width="1.5" stroke="white" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </div>
        <div>
          <p class="text-2xl font-bold text-gray-800 tabular-nums">{{ pendientes.toLocaleString() }}</p>
          <p class="text-xs text-gray-500 mt-0.5 uppercase tracking-wide font-medium">Fichas por completar</p>
        </div>
      </div>

      <!-- Bautismos confirmados -->
      <div class="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
        <div class="w-11 h-11 rounded-xl bg-violet-500 flex items-center justify-center shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            stroke-width="1.5" stroke="white" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M12 2.25c-3.75 6-7.5 8.25-7.5 12.75a7.5 7.5 0 0 0 15 0c0-4.5-3.75-6.75-7.5-12.75Z" />
          </svg>
        </div>
        <div>
          <p class="text-2xl font-bold text-gray-800 tabular-nums">{{ bautismosConfirmados.toLocaleString() }}</p>
          <p class="text-xs text-gray-500 mt-0.5 uppercase tracking-wide font-medium">Bautismos</p>
        </div>
      </div>

    </div>

    <!-- Chart -->
    <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div class="flex items-center justify-between mb-5">
        <div>
          <h3 class="text-sm font-semibold text-gray-700">Actividad por día</h3>
          <p class="text-xs text-gray-400 mt-0.5">Todos los tiempos · agrupado por mes</p>
        </div>
        <!-- Legend dots -->
        <div class="hidden sm:flex items-center gap-4 text-xs text-gray-500">
          <span class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full bg-[#068ab8] inline-block" />
            Generadas
          </span>
          <span class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            Completadas
          </span>
          <span class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block" />
            Por completar
          </span>
        </div>
      </div>
      <div class="h-64">
        <Bar v-if="chartBuckets.length" :data="chartData" :options="chartOptions" />
        <div v-else class="h-full flex items-center justify-center">
          <p class="text-sm text-gray-300">Cargando datos…</p>
        </div>
      </div>
    </div>

  </div>
</template>
