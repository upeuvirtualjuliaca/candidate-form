<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { fetchTeacherImportLogs, type ImportLog, type ImportStatus } from '../services/importTeachers.service'

const props = defineProps<{ refreshTrigger: number }>()

const logs       = ref<ImportLog[]>([])
const totalCount = ref(0)
const loading    = ref(true)
const error      = ref('')
const page       = ref(1)
const pageSize   = 10

const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / pageSize)))
const from       = computed(() => (page.value - 1) * pageSize + 1)
const to         = computed(() => Math.min(page.value * pageSize, totalCount.value))

async function load() {
  loading.value = true
  error.value   = ''
  try {
    const res        = await fetchTeacherImportLogs(page.value, pageSize)
    logs.value       = res.data
    totalCount.value = res.count
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Error al cargar el historial.'
  } finally {
    loading.value = false
  }
}

function goTo(p: number) {
  if (p < 1 || p > totalPages.value) return
  page.value = p
}

onMounted(load)
watch(() => page.value, load)
watch(() => props.refreshTrigger, () => { page.value = 1; load() })

const badgeClasses: Record<ImportStatus, string> = {
  success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  partial: 'bg-amber-50  text-amber-700  ring-1 ring-amber-200',
  error:   'bg-red-50    text-red-700    ring-1 ring-red-200',
}

const badgeLabels: Record<ImportStatus, string> = {
  success: 'Exitoso',
  partial: 'Parcial',
  error:   'Error',
}

const badgeDot: Record<ImportStatus, string> = {
  success: 'bg-emerald-500',
  partial: 'bg-amber-500',
  error:   'bg-red-500',
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

function shortName(name: string): string {
  return name.length > 30 ? name.slice(0, 28) + '…' : name
}
</script>

<template>
  <div class="space-y-4">

    <div v-if="error && !loading" class="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="#ef4444" class="w-5 h-5 shrink-0">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
      </svg>
      <p class="text-sm text-red-700">{{ error }}</p>
      <button type="button" @click="load" class="ml-auto text-xs font-medium text-red-700 underline underline-offset-2">Reintentar</button>
    </div>

    <div v-else-if="loading" class="space-y-2.5">
      <div v-for="i in pageSize" :key="i" class="h-14 bg-gray-100 rounded-xl animate-pulse" :style="{ opacity: 1 - i * 0.07 }" />
    </div>

    <div v-else-if="logs.length === 0" class="flex flex-col items-center justify-center py-20 text-center">
      <div class="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.3" stroke="#9ca3af" class="w-6 h-6">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      </div>
      <p class="text-sm font-medium text-gray-500">Sin importaciones registradas</p>
      <p class="text-xs text-gray-400 mt-1">El historial aparecerá aquí después de la primera importación.</p>
    </div>

    <template v-else>
      <div class="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1.5fr] gap-3 px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
        <span>Archivo</span>
        <span class="text-right">Total</span>
        <span class="text-right">Insertados</span>
        <span class="text-right">Actualizados</span>
        <span class="text-right">Errores</span>
        <span>Estado</span>
        <span>Fecha</span>
      </div>

      <div class="space-y-2">
        <div v-for="log in logs" :key="log.id" class="bg-gray-50 hover:bg-[#04395a]/3 rounded-xl transition-colors duration-150">

          <div class="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1.5fr] gap-3 items-center px-4 py-3.5">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-7 h-7 rounded-lg bg-[#04395a]/8 flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="#04395a" class="w-3.5 h-3.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
              </div>
              <span class="text-sm font-medium text-gray-700 truncate" :title="log.file_name">{{ shortName(log.file_name) }}</span>
            </div>
            <span class="text-sm text-gray-600 text-right tabular-nums">{{ log.total_records.toLocaleString() }}</span>
            <span class="text-sm font-medium text-emerald-600 text-right tabular-nums">{{ log.inserted_records.toLocaleString() }}</span>
            <span class="text-sm text-amber-600 text-right tabular-nums">{{ log.duplicate_records.toLocaleString() }}</span>
            <span class="text-sm text-right tabular-nums" :class="log.error_records > 0 ? 'text-red-600 font-medium' : 'text-gray-400'">{{ log.error_records.toLocaleString() }}</span>
            <span :class="['inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold w-fit', badgeClasses[log.status]]">
              <span :class="['w-1.5 h-1.5 rounded-full', badgeDot[log.status]]" />
              {{ badgeLabels[log.status] }}
            </span>
            <span class="text-xs text-gray-400">{{ formatDate(log.created_at) }}</span>
          </div>

          <div class="sm:hidden p-4 space-y-3">
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <div class="w-7 h-7 rounded-lg bg-[#04395a]/8 flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="#04395a" class="w-3.5 h-3.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                </div>
                <span class="text-sm font-medium text-gray-700 truncate">{{ shortName(log.file_name) }}</span>
              </div>
              <span :class="['inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0', badgeClasses[log.status]]">
                <span :class="['w-1.5 h-1.5 rounded-full', badgeDot[log.status]]" />
                {{ badgeLabels[log.status] }}
              </span>
            </div>
            <div class="grid grid-cols-4 gap-2 text-center">
              <div class="bg-white rounded-lg p-2">
                <p class="text-sm font-bold text-gray-700 tabular-nums">{{ log.total_records.toLocaleString() }}</p>
                <p class="text-[10px] text-gray-400 mt-0.5">Total</p>
              </div>
              <div class="bg-white rounded-lg p-2">
                <p class="text-sm font-bold text-emerald-600 tabular-nums">{{ log.inserted_records.toLocaleString() }}</p>
                <p class="text-[10px] text-gray-400 mt-0.5">Insertados</p>
              </div>
              <div class="bg-white rounded-lg p-2">
                <p class="text-sm font-bold text-amber-600 tabular-nums">{{ log.duplicate_records.toLocaleString() }}</p>
                <p class="text-[10px] text-gray-400 mt-0.5">Actual.</p>
              </div>
              <div class="bg-white rounded-lg p-2">
                <p class="text-sm font-bold tabular-nums" :class="log.error_records > 0 ? 'text-red-600' : 'text-gray-400'">{{ log.error_records.toLocaleString() }}</p>
                <p class="text-[10px] text-gray-400 mt-0.5">Errores</p>
              </div>
            </div>
            <p class="text-xs text-gray-400">{{ formatDate(log.created_at) }}</p>
          </div>

        </div>
      </div>

      <div v-if="totalPages > 1" class="flex items-center justify-between pt-2">
        <p class="text-xs text-gray-400">{{ from }}–{{ to }} de {{ totalCount.toLocaleString() }} registros</p>
        <div class="flex items-center gap-1">
          <button type="button" :disabled="page === 1" @click="goTo(page - 1)"
            class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <template v-for="p in totalPages" :key="p">
            <button v-if="p === 1 || p === totalPages || Math.abs(p - page) <= 1" type="button" @click="goTo(p)"
              :class="['w-8 h-8 rounded-lg text-xs font-medium transition-colors', p === page ? 'bg-[#04395a] text-white' : 'text-gray-600 hover:bg-gray-100']">
              {{ p }}
            </button>
            <span v-else-if="p === 2 && page > 3 || p === totalPages - 1 && page < totalPages - 2"
              class="w-8 h-8 flex items-center justify-center text-gray-300 text-xs">…</span>
          </template>
          <button type="button" :disabled="page === totalPages" @click="goTo(page + 1)"
            class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </div>

    </template>
  </div>
</template>
