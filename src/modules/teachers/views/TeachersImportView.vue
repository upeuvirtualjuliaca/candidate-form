<script setup lang="ts">
import { ref, computed } from 'vue'
import Tabs, { type Tab } from '@/components/ui/Tabs.vue'
import TeachersImportHistoryTab from '../components/TeachersImportHistoryTab.vue'
import { parseExcelFile, type ParsedTeacher } from '../utils/excelTeachers.parser'
import {
  importTeachers,
  saveTeacherImportLog,
  type ImportProgress,
  type ImportResult,
} from '../services/importTeachers.service'

// ── Tabs ───────────────────────────────────────────────────────────────────
const tabs: Tab[] = [
  { key: 'import',  label: 'Importar' },
  { key: 'history', label: 'Historial' },
]
const activeTab      = ref('import')
const historyRefresh = ref(0)

// ── Import state ───────────────────────────────────────────────────────────
type Stage = 'idle' | 'parsing' | 'importing' | 'done' | 'error'

const stage          = ref<Stage>('idle')
const dragOver       = ref(false)
const selectedFile   = ref<File | null>(null)
const parsedTeachers = ref<ParsedTeacher[]>([])
const progress       = ref<ImportProgress>({ processed: 0, total: 0, percent: 0 })
const result         = ref<ImportResult | null>(null)
const errorMessage   = ref('')
const parseSkipped   = ref(0)
const missingCols    = ref<string[]>([])

const canImport = computed(() =>
  stage.value === 'idle' && selectedFile.value !== null && parsedTeachers.value.length > 0,
)
const isLoading = computed(() =>
  stage.value === 'parsing' || stage.value === 'importing',
)

// ── File handling ──────────────────────────────────────────────────────────
function validateFileType(file: File): boolean {
  return (
    file.name.endsWith('.xlsx') ||
    file.name.endsWith('.xls') ||
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.type === 'application/vnd.ms-excel'
  )
}

async function handleFile(file: File) {
  if (!validateFileType(file)) {
    errorMessage.value = 'Formato no válido. Solo se aceptan archivos .xlsx o .xls'
    stage.value        = 'error'
    return
  }
  stage.value          = 'parsing'
  errorMessage.value   = ''
  result.value         = null
  missingCols.value    = []
  parsedTeachers.value = []

  try {
    const parsed = await parseExcelFile(file)
    if (parsed.missingColumns.length > 0) {
      missingCols.value  = parsed.missingColumns
      stage.value        = 'error'
      errorMessage.value = 'Columnas obligatorias no encontradas en el archivo.'
      selectedFile.value = null
      return
    }
    selectedFile.value   = file
    parsedTeachers.value = parsed.teachers
    parseSkipped.value   = parsed.skippedRows
    stage.value          = 'idle'
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Error al leer el archivo.'
    stage.value        = 'error'
    selectedFile.value = null
  }
}

function onFileInput(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) handleFile(file)
}

function onDrop(e: DragEvent) {
  dragOver.value = false
  const file = e.dataTransfer?.files[0]
  if (file) handleFile(file)
}

function clearFile() {
  selectedFile.value   = null
  parsedTeachers.value = []
  parseSkipped.value   = 0
  missingCols.value    = []
  errorMessage.value   = ''
  result.value         = null
  stage.value          = 'idle'
  progress.value       = { processed: 0, total: 0, percent: 0 }
}

// ── Import + log ───────────────────────────────────────────────────────────
async function startImport() {
  if (!canImport.value || !selectedFile.value) return

  const fileName = selectedFile.value.name
  stage.value    = 'importing'
  progress.value = { processed: 0, total: parsedTeachers.value.length, percent: 0 }

  try {
    const importResult = await importTeachers(parsedTeachers.value, (p) => {
      progress.value = p
    })

    await saveTeacherImportLog(fileName, importResult)

    result.value = importResult
    stage.value  = 'done'
    historyRefresh.value++
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Error durante la importación.'
    stage.value        = 'error'
  }
}

function goToHistory() {
  activeTab.value = 'history'
}
</script>

<template>
  <div class="space-y-6">
    <!-- Heading -->
    <div>
      <h2 class="text-2xl font-bold text-[#04395a]">Docentes</h2>
      <p class="text-sm text-gray-500 mt-0.5">Importación y registro de docentes desde archivo Excel.</p>
    </div>

    <!-- Tabs container -->
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="px-6 pt-4">
        <Tabs v-model="activeTab" :tabs="tabs" />
      </div>

      <div class="px-6 pb-6">

        <!-- ════════════════════════════════════════════════════════════════
             TAB: Importar
        ════════════════════════════════════════════════════════════════ -->
        <div v-show="activeTab === 'import'" class="mt-2 space-y-5">
          <p class="text-xs text-gray-400 pt-1">
            Carga un archivo Excel (.xlsx / .xls) con la nómina de docentes. Las filas duplicadas por DNI se agrupan automáticamente y se calcula la EP principal.
          </p>

          <!-- Drop zone -->
          <div
            v-if="!selectedFile && stage !== 'parsing'"
            :class="[
              'border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center cursor-pointer',
              'transition-colors duration-200',
              dragOver
                ? 'border-[#068ab8] bg-[#068ab8]/5'
                : 'border-gray-200 hover:border-[#04395a]/40 hover:bg-gray-50',
            ]"
            @dragover.prevent="dragOver = true"
            @dragleave.prevent="dragOver = false"
            @drop.prevent="onDrop"
            @click="($refs.fileInput as HTMLInputElement).click()"
          >
            <div class="w-14 h-14 rounded-2xl bg-[#04395a]/6 flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.4" stroke="#04395a" class="w-7 h-7">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </div>
            <p class="text-sm font-medium text-gray-700">
              Arrastra tu archivo aquí o
              <span class="text-[#068ab8] underline underline-offset-2">haz clic para buscar</span>
            </p>
            <p class="text-xs text-gray-400 mt-1">Formatos aceptados: .xlsx, .xls</p>
            <input ref="fileInput" type="file" accept=".xlsx,.xls" class="hidden" @change="onFileInput" />
          </div>

          <!-- Parsing spinner -->
          <div v-if="stage === 'parsing'" class="flex items-center gap-3 py-4">
            <svg class="w-5 h-5 text-[#068ab8] animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <span class="text-sm text-gray-600">Leyendo y agrupando docentes…</span>
          </div>

          <!-- File preview -->
          <div
            v-if="selectedFile && stage !== 'importing' && stage !== 'parsing'"
            class="flex items-center gap-4 p-4 bg-gray-50 rounded-xl"
          >
            <div class="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="#10b981" class="w-5 h-5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-800 truncate">{{ selectedFile.name }}</p>
              <p class="text-xs text-gray-400 mt-0.5">
                {{ parsedTeachers.length.toLocaleString() }} docentes únicos listos
                <span v-if="parseSkipped > 0" class="text-amber-500"> · {{ parseSkipped }} filas omitidas</span>
              </p>
            </div>
            <button
              type="button"
              @click="clearFile"
              :disabled="isLoading"
              class="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Step 2: confirm + progress -->
          <div v-if="parsedTeachers.length > 0 || stage === 'importing' || stage === 'done'" class="space-y-4">
            <div class="h-px bg-gray-100" />

            <!-- Pre-import stats -->
            <div v-if="stage === 'idle'" class="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div class="bg-[#04395a]/5 rounded-xl p-4 text-center">
                <p class="text-2xl font-bold text-[#04395a]">{{ parsedTeachers.length.toLocaleString() }}</p>
                <p class="text-xs text-gray-500 mt-0.5">Docentes a importar</p>
              </div>
              <div class="bg-amber-50 rounded-xl p-4 text-center">
                <p class="text-2xl font-bold text-amber-600">{{ parseSkipped }}</p>
                <p class="text-xs text-gray-500 mt-0.5">Filas omitidas</p>
              </div>
              <div class="col-span-2 sm:col-span-1 bg-gray-50 rounded-xl p-4 text-center">
                <p class="text-2xl font-bold text-gray-600">500</p>
                <p class="text-xs text-gray-500 mt-0.5">Registros por lote</p>
              </div>
            </div>

            <!-- Progress bar -->
            <div v-if="stage === 'importing'" class="space-y-3">
              <div class="flex items-center justify-between text-sm">
                <div class="flex items-center gap-2 text-gray-600">
                  <svg class="w-4 h-4 text-[#068ab8] animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  <span>Importando docentes…</span>
                </div>
                <span class="font-semibold text-[#04395a]">{{ progress.percent }}%</span>
              </div>
              <div class="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  class="h-full bg-gradient-to-r from-[#04395a] to-[#068ab8] rounded-full transition-all duration-300"
                  :style="{ width: `${progress.percent}%` }"
                />
              </div>
              <p class="text-xs text-gray-400 text-right">
                {{ progress.processed.toLocaleString() }} / {{ progress.total.toLocaleString() }} docentes
              </p>
            </div>

            <!-- Import button -->
            <button
              v-if="stage === 'idle'"
              type="button"
              :disabled="!canImport"
              @click="startImport"
              class="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#04395a] hover:bg-[#068ab8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-4 h-4">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Iniciar importación
            </button>
          </div>

          <!-- Result card -->
          <Transition name="slide-up">
            <div v-if="stage === 'done' && result" class="rounded-2xl border border-gray-100 overflow-hidden">
              <div class="px-5 py-4 bg-emerald-50 border-b border-emerald-100 flex items-center gap-3">
                <div class="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="white" class="w-3.5 h-3.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                </div>
                <div>
                  <p class="text-sm font-semibold text-emerald-800">Importación completada</p>
                  <p class="text-xs text-emerald-600">Registro guardado en el historial.</p>
                </div>
              </div>

              <div class="p-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div class="text-center p-3 bg-gray-50 rounded-xl">
                  <p class="text-xl font-bold text-gray-700">{{ result.total.toLocaleString() }}</p>
                  <p class="text-xs text-gray-500 mt-0.5">Total leídos</p>
                </div>
                <div class="text-center p-3 bg-emerald-50 rounded-xl">
                  <p class="text-xl font-bold text-emerald-600">{{ result.inserted.toLocaleString() }}</p>
                  <p class="text-xs text-gray-500 mt-0.5">Insertados</p>
                </div>
                <div class="text-center p-3 bg-amber-50 rounded-xl">
                  <p class="text-xl font-bold text-amber-600">{{ result.duplicates.toLocaleString() }}</p>
                  <p class="text-xs text-gray-500 mt-0.5">Actualizados</p>
                </div>
                <div class="text-center p-3 rounded-xl" :class="result.errors > 0 ? 'bg-red-50' : 'bg-gray-50'">
                  <p class="text-xl font-bold" :class="result.errors > 0 ? 'text-red-600' : 'text-gray-400'">{{ result.errors }}</p>
                  <p class="text-xs text-gray-500 mt-0.5">Errores</p>
                </div>
              </div>

              <div class="px-5 pb-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  @click="clearFile"
                  class="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[#04395a] hover:bg-[#068ab8] transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-3.5 h-3.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                  </svg>
                  Nueva importación
                </button>
                <button
                  type="button"
                  @click="goToHistory"
                  class="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-[#04395a] bg-[#04395a]/8 hover:bg-[#04395a]/15 transition-colors"
                >
                  Ver historial
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-3.5 h-3.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </button>
              </div>
            </div>
          </Transition>

          <!-- Error alert -->
          <Transition name="slide-up">
            <div v-if="stage === 'error'" class="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
              <div class="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="#ef4444" class="w-3.5 h-3.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-red-800">{{ errorMessage }}</p>
                <div v-if="missingCols.length" class="flex flex-wrap gap-1 mt-2">
                  <span v-for="col in missingCols" :key="col"
                    class="text-xs text-red-500 font-mono bg-red-100 px-2 py-0.5 rounded">{{ col }}</span>
                </div>
                <button type="button" @click="clearFile" class="mt-2 text-xs font-medium text-red-700 underline underline-offset-2">
                  Intentar de nuevo
                </button>
              </div>
            </div>
          </Transition>
        </div>

        <!-- ════════════════════════════════════════════════════════════════
             TAB: Historial
        ════════════════════════════════════════════════════════════════ -->
        <div v-show="activeTab === 'history'" class="mt-2">
          <TeachersImportHistoryTab :refresh-trigger="historyRefresh" />
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
.slide-up-enter-active, .slide-up-leave-active { transition: all 0.25s ease; }
.slide-up-enter-from, .slide-up-leave-to { opacity: 0; transform: translateY(8px); }
</style>
