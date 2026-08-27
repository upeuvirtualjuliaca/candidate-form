<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { usePermissions } from '@/composables/usePermissions'
import { useCampaignStore } from '@/modules/campaigns/store/campaign.store'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'vue-chartjs'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import Tabs, { type Tab } from '@/components/ui/Tabs.vue'
import { supabase } from '@/core/supabase'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const { canWrite } = usePermissions()
const campaignStore = useCampaignStore()
const { selected: selectedCampaign } = storeToRefs(campaignStore)

const tabs: Tab[] = [
  { key: 'today', label: 'Hoy' },
  { key: 'baptism', label: 'Bautismo' },
]
const activeTab = ref('today')

// ── Hoy ────────────────────────────────────────────────────────────────────

const todayLoading = ref(false)
const todayTotal = ref(0)
const todayCompleted = ref(0)
const todayDraft = ref(0)

const todayPct = computed(() =>
  todayTotal.value === 0 ? 0 : Math.round((todayCompleted.value / todayTotal.value) * 100),
)

async function loadToday() {
  todayLoading.value = true
  try {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    const { data, error } = await supabase
      .from('candidates')
      .select('status')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
    if (error) throw error
    const rows = data ?? []
    todayTotal.value = rows.length
    todayCompleted.value = rows.filter((r) => r.status === 'completed').length
    todayDraft.value = rows.filter((r) => r.status === 'draft').length
  } finally {
    todayLoading.value = false
  }
}

// ── Bautismo ────────────────────────────────────────────────────────────────

interface BaptismRow {
  id: string
  status: string
  created_at: string
  students: {
    full_name: string | null
    dni: string | null
    phone: string | null
    campus: string | null
    faculty: string | null
    program: string | null
  } | null
  teachers: {
    full_name: string | null
    dni: string | null
    campus: string | null
    faculty: string | null
    main_ep: string | null
  } | null
}

const baptismLoading = ref(false)
const baptismAll = ref<BaptismRow[]>([])
const showCompleted = ref(false)
const showDraft = ref(false)
const filterDateFrom = ref('')
const filterDateTo = ref('')
const filterCampus = ref('')
const filterFaculty = ref('')
const filterProgram = ref('')
const baptismPage = ref(1)
const PAGE_SIZE = 10

const currentYear = new Date().getFullYear()
const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const MONTH_NAMES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function selectMonth(monthIndex: number) {
  const firstDay = new Date(currentYear, monthIndex, 1)
  const lastDay = new Date(currentYear, monthIndex + 1, 0)
  filterDateFrom.value = firstDay.toISOString().slice(0, 10)
  filterDateTo.value = lastDay.toISOString().slice(0, 10)
  baptismPage.value = 1
}

function clearDateRange() {
  filterDateFrom.value = ''
  filterDateTo.value = ''
  baptismPage.value = 1
}

const activeMonthPill = computed(() => {
  if (!filterDateFrom.value || !filterDateTo.value) return null
  for (let m = 0; m < 12; m++) {
    const firstDay = new Date(currentYear, m, 1).toISOString().slice(0, 10)
    const lastDay = new Date(currentYear, m + 1, 0).toISOString().slice(0, 10)
    if (filterDateFrom.value === firstDay && filterDateTo.value === lastDay) return m
  }
  return null
})

const dateRangeLabel = computed(() => {
  if (!filterDateFrom.value && !filterDateTo.value) return ''
  if (activeMonthPill.value !== null) return `${MONTH_NAMES_FULL[activeMonthPill.value]} ${currentYear}`
  const from = filterDateFrom.value ? fmtDate(filterDateFrom.value) : ''
  const to = filterDateTo.value ? fmtDate(filterDateTo.value) : ''
  if (from && to) return `${from} – ${to}`
  if (from) return `Desde ${from}`
  return `Hasta ${to}`
})

async function loadBaptism() {
  baptismLoading.value = true
  baptismPage.value = 1
  clearFilters()
  try {
    let query = supabase
      .from('candidates')
      .select(
        `
        id, status, created_at,
        students ( full_name, dni, phone, campus, faculty, program ),
        teachers ( full_name, dni, campus, faculty, main_ep )
      `,
      )
      .order('created_at', { ascending: false })

    if (selectedCampaign.value?.id) {
      query = query.eq('campaign_id', selectedCampaign.value.id)
    }

    const { data, error } = await query
    if (error) throw error
    baptismAll.value = (data ?? []) as unknown as BaptismRow[]
  } finally {
    baptismLoading.value = false
  }
}

watch(activeTab, (tab) => {
  if (tab === 'baptism' && !baptismLoading.value) loadBaptism()
})

// Reload baptism data when campaign changes
watch(selectedCampaign, () => {
  if (activeTab.value === 'baptism') loadBaptism()
  else baptismAll.value = [] // force reload on next tab switch
})

// helpers
function rowDate(r: BaptismRow) {
  return r.created_at.slice(0, 10)
}
function rowCampus(r: BaptismRow) {
  return r.students?.campus ?? r.teachers?.campus ?? ''
}
function rowFaculty(r: BaptismRow) {
  return r.students?.faculty ?? r.teachers?.faculty ?? ''
}
function rowProgram(r: BaptismRow) {
  return r.students?.program ?? r.teachers?.main_ep ?? ''
}

function clearFilters() {
  filterDateFrom.value = ''
  filterDateTo.value = ''
  filterCampus.value = ''
  filterFaculty.value = ''
  filterProgram.value = ''
  baptismPage.value = 1
}
function rowName(r: BaptismRow) {
  return r.students?.full_name ?? r.teachers?.full_name ?? '—'
}
function rowDni(r: BaptismRow) {
  return r.students?.dni ?? r.teachers?.dni ?? '—'
}
function rowPhone(r: BaptismRow) {
  return r.students?.phone ?? '—'
}
function rowType(r: BaptismRow) {
  if (r.students) return 'Alumno'
  if (r.teachers) return 'Docente'
  return 'Libre'
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// ── Exports ────────────────────────────────────────────────────────────────

function tableRows() {
  return baptismFiltered.value.map((r, i) => ({
    '#': i + 1,
    Tipo: rowType(r),
    Nombre: rowName(r),
    'DNI/Código': rowDni(r),
    Teléfono: rowPhone(r),
    Sede: rowCampus(r) || '—',
    Facultad: rowFaculty(r) || '—',
    EP: rowProgram(r) || '—',
    Estado: r.status === 'completed' ? 'Bautizado' : 'Pendiente',
    Fecha: fmtDate(rowDate(r)),
  }))
}

function exportExcel() {
  const ws = XLSX.utils.json_to_sheet(tableRows())
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Candidatos')
  XLSX.writeFile(wb, `reporte_bautismo_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

function exportPdf() {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const PW = 277 // printable width (297 - 2*10 margins)
  const ML = 10 // margin left
  const cols = ['#', 'Tipo', 'Nombre', 'DNI/Código', 'Teléfono', 'Sede', 'Facultad', 'EP', 'Estado']
  const colW = [8, 16, 50, 24, 24, 28, 40, 40, 22] // mm, sums ~252, rest for padding
  const ROW_H = 6
  const HEAD_H = 7

  // ── Header ──
  doc.setFontSize(13)
  doc.setTextColor(4, 57, 90)
  doc.text('Reporte de Bautismo — UPEU', ML, 12)

  doc.setFontSize(7.5)
  doc.setTextColor(100, 100, 100)
  const filters: string[] = []
  if (filterDateFrom.value || filterDateTo.value) {
    if (activeMonthPill.value !== null) {
      filters.push(`Mes: ${MONTH_NAMES_FULL[activeMonthPill.value]} ${currentYear}`)
    } else {
      const from = filterDateFrom.value ? fmtDate(filterDateFrom.value) : '—'
      const to = filterDateTo.value ? fmtDate(filterDateTo.value) : '—'
      filters.push(`Periodo: ${from} – ${to}`)
    }
  }
  if (filterCampus.value) filters.push(`Campus: ${filterCampus.value}`)
  if (filterFaculty.value) filters.push(`Facultad: ${filterFaculty.value}`)
  if (filterProgram.value) filters.push(`EP: ${filterProgram.value}`)
  doc.text(filters.length ? filters.join('   ·   ') : 'Sin filtros aplicados', ML, 18)
  doc.text(
    `Total: ${bTotal.value}   Bautizados: ${bCompleted.value}   Pendientes: ${bDraft.value}   Generado: ${new Date().toLocaleDateString('es-PE')}`,
    ML,
    23,
  )

  // ── Table header ──
  let y = 28
  doc.setFillColor(4, 57, 90)
  doc.rect(ML, y, PW, HEAD_H, 'F')
  doc.setFontSize(7)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  let x = ML + 1.5
  cols.forEach((col, i) => {
    doc.text(col, x, y + HEAD_H - 2)
    x += colW[i]!
  })
  y += HEAD_H

  // ── Table rows ──
  doc.setFont('helvetica', 'normal')
  const rows = tableRows()
  rows.forEach((row, idx) => {
    if (y + ROW_H > 200) {
      doc.addPage()
      y = 15
    }
    // alternate row bg
    if (idx % 2 === 0) {
      doc.setFillColor(245, 247, 250)
      doc.rect(ML, y, PW, ROW_H, 'F')
    }
    doc.setTextColor(40, 40, 40)
    doc.setFontSize(6.5)
    const vals = Object.values(row).slice(0, 9) as string[] // exclude Fecha from PDF columns
    let cx = ML + 1.5
    vals.forEach((val, i) => {
      const maxW = (colW[i] ?? 20) - 2
      const txt = doc.splitTextToSize(String(val), maxW)[0] ?? ''
      doc.text(txt, cx, y + ROW_H - 1.8)
      cx += colW[i]!
    })
    // bottom border
    doc.setDrawColor(230, 230, 230)
    doc.setLineWidth(0.1)
    doc.line(ML, y + ROW_H, ML + PW, y + ROW_H)
    y += ROW_H
  })

  doc.save(`reporte_bautismo_${new Date().toISOString().slice(0, 10)}.pdf`)
}

// filter options
const optCampuses = computed(() =>
  [...new Set(baptismAll.value.map(rowCampus).filter(Boolean))].sort(),
)
const optFaculties = computed(() => {
  const base = filterCampus.value
    ? baptismAll.value.filter((r) => rowCampus(r) === filterCampus.value)
    : baptismAll.value
  return [...new Set(base.map(rowFaculty).filter(Boolean))].sort()
})
const optPrograms = computed(() => {
  let base = baptismAll.value
  if (filterCampus.value) base = base.filter((r) => rowCampus(r) === filterCampus.value)
  if (filterFaculty.value) base = base.filter((r) => rowFaculty(r) === filterFaculty.value)
  return [...new Set(base.map(rowProgram).filter(Boolean))].sort()
})

// reset cascade
watch(filterCampus, () => {
  filterFaculty.value = ''
  filterProgram.value = ''
})
watch(filterFaculty, () => {
  filterProgram.value = ''
})

// filtered rows
const baptismFiltered = computed(() => {
  return baptismAll.value.filter((r) => {
    const d = rowDate(r)
    if (filterDateFrom.value && d < filterDateFrom.value) return false
    if (filterDateTo.value && d > filterDateTo.value) return false
    if (filterCampus.value && rowCampus(r) !== filterCampus.value) return false
    if (filterFaculty.value && rowFaculty(r) !== filterFaculty.value) return false
    if (filterProgram.value && rowProgram(r) !== filterProgram.value) return false
    return true
  })
})

watch(baptismFiltered, () => { baptismPage.value = 1 })

const baptismTotalPages = computed(() => Math.ceil(baptismFiltered.value.length / PAGE_SIZE))
const baptismPaged = computed(() => {
  const start = (baptismPage.value - 1) * PAGE_SIZE
  return baptismFiltered.value.slice(start, start + PAGE_SIZE)
})

// summary cards
const bTotal = computed(() => baptismFiltered.value.length)
const bCompleted = computed(
  () => baptismFiltered.value.filter((r) => r.status === 'completed').length,
)
const bDraft = computed(() => baptismFiltered.value.filter((r) => r.status === 'draft').length)
const bPct = computed(() =>
  bTotal.value === 0 ? 0 : Math.round((bCompleted.value / bTotal.value) * 100),
)

// chart helper
function buildChartData(groupFn: (r: BaptismRow) => string) {
  const groups: Record<string, { total: number; completed: number }> = {}
  for (const r of baptismFiltered.value) {
    const key = groupFn(r) || 'Sin datos'
    if (!groups[key]) groups[key] = { total: 0, completed: 0 }
    groups[key]!.total++
    if (r.status === 'completed') groups[key]!.completed++
  }
  const labels = Object.keys(groups).sort()
  return {
    labels,
    datasets: [
      {
        label: 'Bautizados',
        data: labels.map((l) => groups[l]!.completed),
        backgroundColor: '#068ab8cc',
        borderColor: '#068ab8',
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: 'Pendientes',
        data: labels.map((l) => groups[l]!.total - groups[l]!.completed),
        backgroundColor: '#f59e0b88',
        borderColor: '#f59e0b',
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  }
}

const chartCampus = computed(() => buildChartData(rowCampus))
const chartFaculty = computed(() => buildChartData(rowFaculty))
const chartProgram = computed(() => buildChartData(rowProgram))

const chartOpts = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' as const, labels: { font: { size: 11 }, boxWidth: 12 } },
    title: { display: false },
  },
  scales: {
    x: { grid: { display: false }, ticks: { font: { size: 10 } } },
    y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 10 } } },
  },
}

onMounted(loadToday)
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-2xl font-bold text-[#04395a]">Reportes</h2>
      <p class="text-sm text-gray-500 mt-0.5">
        <template v-if="selectedCampaign">
          Campaña: <span class="font-semibold text-[#04395a]">{{ selectedCampaign.name }}</span>
        </template>
        <template v-else>Análisis y exportación de información del sistema.</template>
      </p>
    </div>

    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="px-6 pt-4">
        <Tabs v-model="activeTab" :tabs="tabs" />
      </div>

      <div class="px-6 pb-6">
        <!-- ══ HOY ═══════════════════════════════════════════════════════════ -->
        <div v-if="activeTab === 'today'" class="pt-4">
          <template v-if="todayLoading">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div v-for="i in 3" :key="i" class="h-28 rounded-2xl bg-gray-100 animate-pulse" />
            </div>
            <div class="h-5 rounded-full bg-gray-100 animate-pulse" />
          </template>
          <template v-else>
            <p class="text-xs text-gray-400 font-medium mb-4">
              {{
                new Date().toLocaleDateString('es-PE', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })
              }}
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div
                class="relative overflow-hidden rounded-2xl border border-[#04395a]/10 bg-gradient-to-br from-[#04395a] to-[#068ab8] p-5 text-white"
              >
                <div class="flex items-start justify-between mb-3">
                  <div class="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke-width="1.5"
                      stroke="currentColor"
                      class="w-5 h-5"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z"
                      />
                    </svg>
                  </div>
                  <span class="text-xs font-medium bg-white/20 px-2 py-0.5 rounded-full"
                    >Total</span
                  >
                </div>
                <p class="text-4xl font-bold tracking-tight">{{ todayTotal }}</p>
                <p class="text-sm text-white/75 mt-1">Fichas generadas hoy</p>
                <div class="absolute -right-4 -bottom-4 w-24 h-24 rounded-full bg-white/5" />
              </div>
              <div
                class="relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-emerald-100/60 p-5"
              >
                <div class="flex items-start justify-between mb-3">
                  <div
                    class="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke-width="1.5"
                      stroke="#10b981"
                      class="w-5 h-5"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                      />
                    </svg>
                  </div>
                  <span
                    class="text-xs font-medium text-emerald-700 bg-emerald-500/10 px-2 py-0.5 rounded-full"
                    >Completados</span
                  >
                </div>
                <p class="text-4xl font-bold tracking-tight text-emerald-700">
                  {{ todayCompleted }}
                </p>
                <p class="text-sm text-emerald-600/80 mt-1">Bautizados hoy</p>
                <div class="absolute -right-4 -bottom-4 w-24 h-24 rounded-full bg-emerald-500/5" />
              </div>
              <div
                class="relative overflow-hidden rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-amber-100/60 p-5"
              >
                <div class="flex items-start justify-between mb-3">
                  <div class="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke-width="1.5"
                      stroke="#f59e0b"
                      class="w-5 h-5"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                      />
                    </svg>
                  </div>
                  <span
                    class="text-xs font-medium text-amber-700 bg-amber-500/10 px-2 py-0.5 rounded-full"
                    >Borradores</span
                  >
                </div>
                <p class="text-4xl font-bold tracking-tight text-amber-700">{{ todayDraft }}</p>
                <p class="text-sm text-amber-600/80 mt-1">Fichas pendientes</p>
                <div class="absolute -right-4 -bottom-4 w-24 h-24 rounded-full bg-amber-500/5" />
              </div>
            </div>
            <div class="rounded-2xl border border-gray-100 bg-gray-50 p-5">
              <div class="flex items-center justify-between mb-3">
                <div>
                  <p class="text-sm font-semibold text-gray-700">Avance de bautismos</p>
                  <p class="text-xs text-gray-400 mt-0.5">
                    {{ todayCompleted }} de {{ todayTotal }} fichas completadas
                  </p>
                </div>
                <span
                  class="text-2xl font-bold"
                  :class="todayPct === 100 ? 'text-emerald-600' : 'text-[#04395a]'"
                  >{{ todayPct }}%</span
                >
              </div>
              <div class="relative h-4 bg-gray-200 rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-700 ease-out"
                  :class="
                    todayPct === 100
                      ? 'bg-emerald-500'
                      : 'bg-gradient-to-r from-[#04395a] to-[#068ab8]'
                  "
                  :style="{ width: todayPct + '%' }"
                />
              </div>
              <div class="flex items-center gap-4 mt-3">
                <span class="flex items-center gap-1.5 text-xs text-gray-500">
                  <span
                    class="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-[#04395a] to-[#068ab8] shrink-0"
                  />Bautizados
                </span>
                <span class="flex items-center gap-1.5 text-xs text-gray-400">
                  <span class="w-2.5 h-2.5 rounded-full bg-gray-200 shrink-0" />Pendientes
                </span>
                <button
                  type="button"
                  @click="loadToday"
                  class="ml-auto flex items-center gap-1 text-xs text-[#04395a] hover:text-[#068ab8] font-medium transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="2"
                    stroke="currentColor"
                    class="w-3.5 h-3.5"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
                    />
                  </svg>
                  Actualizar
                </button>
              </div>
              <div v-if="todayTotal === 0" class="mt-4 text-center py-4">
                <p class="text-xs text-gray-400">No hay fichas registradas hoy.</p>
              </div>
            </div>
          </template>
        </div>

        <!-- ══ BAUTISMO ═══════════════════════════════════════════════════════ -->
        <div v-else-if="activeTab === 'baptism'" class="pt-4 space-y-5">
          <!-- Skeleton -->
          <template v-if="baptismLoading">
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div v-for="i in 4" :key="i" class="h-10 rounded-xl bg-gray-100 animate-pulse" />
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div v-for="i in 3" :key="i" class="h-24 rounded-2xl bg-gray-100 animate-pulse" />
            </div>
            <div class="h-48 rounded-2xl bg-gray-100 animate-pulse" />
          </template>

          <template v-else>
            <!-- ── Filtros ── -->
            <div class="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Filtros
              </p>

              <!-- Pills de mes rápido -->
              <div class="mb-3">
                <p class="text-xs text-gray-400 mb-2">Mes rápido ({{ currentYear }})</p>
                <div class="flex flex-wrap gap-1">
                  <button
                    v-for="(m, i) in MONTH_LABELS"
                    :key="i"
                    type="button"
                    @click="activeMonthPill === i ? clearDateRange() : selectMonth(i)"
                    class="px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors"
                    :class="
                      activeMonthPill === i
                        ? 'bg-[#04395a] text-white'
                        : 'bg-gray-200 text-gray-600 hover:bg-[#04395a]/15 hover:text-[#04395a]'
                    "
                  >
                    {{ m }}
                  </button>
                </div>
              </div>

              <!-- Inputs de rango + otros filtros -->
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <!-- Desde -->
                <div>
                  <label class="text-xs text-gray-500 font-medium mb-1 block">Desde</label>
                  <input
                    type="date"
                    v-model="filterDateFrom"
                    class="w-full text-sm rounded-xl border border-gray-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a]/40"
                  />
                </div>

                <!-- Hasta -->
                <div>
                  <label class="text-xs text-gray-500 font-medium mb-1 block">Hasta</label>
                  <input
                    type="date"
                    v-model="filterDateTo"
                    class="w-full text-sm rounded-xl border border-gray-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a]/40"
                  />
                </div>

                <!-- Campus -->
                <div>
                  <label class="text-xs text-gray-500 font-medium mb-1 block">Campus / Sede</label>
                  <select
                    v-model="filterCampus"
                    class="w-full text-sm rounded-xl border border-gray-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a]/40"
                  >
                    <option value="">Todos los campus</option>
                    <option v-for="c in optCampuses" :key="c" :value="c">{{ c }}</option>
                  </select>
                </div>

                <!-- Facultad -->
                <div>
                  <label class="text-xs text-gray-500 font-medium mb-1 block">Facultad</label>
                  <select
                    v-model="filterFaculty"
                    class="w-full text-sm rounded-xl border border-gray-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a]/40"
                  >
                    <option value="">Todas las facultades</option>
                    <option v-for="f in optFaculties" :key="f" :value="f">{{ f }}</option>
                  </select>
                </div>

                <!-- EP -->
                <div>
                  <label class="text-xs text-gray-500 font-medium mb-1 block">Escuela Profesional</label>
                  <select
                    v-model="filterProgram"
                    class="w-full text-sm rounded-xl border border-gray-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a]/40"
                  >
                    <option value="">Todas las EPs</option>
                    <option v-for="p in optPrograms" :key="p" :value="p">{{ p }}</option>
                  </select>
                </div>
              </div>

              <!-- Active filters + clear -->
              <div
                v-if="filterDateFrom || filterDateTo || filterCampus || filterFaculty || filterProgram"
                class="flex items-center gap-2 mt-3 flex-wrap"
              >
                <span class="text-xs text-gray-400">Filtros activos:</span>
                <span
                  v-if="dateRangeLabel"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[#04395a]/10 text-[#04395a] font-medium"
                >
                  {{ dateRangeLabel }}
                  <button @click="clearDateRange()" class="hover:text-red-500">×</button>
                </span>
                <span
                  v-if="filterCampus"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[#04395a]/10 text-[#04395a] font-medium"
                >
                  {{ filterCampus }}
                  <button @click="filterCampus = ''" class="hover:text-red-500">×</button>
                </span>
                <span
                  v-if="filterFaculty"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[#04395a]/10 text-[#04395a] font-medium"
                >
                  {{ filterFaculty }}
                  <button @click="filterFaculty = ''" class="hover:text-red-500">×</button>
                </span>
                <span
                  v-if="filterProgram"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[#04395a]/10 text-[#04395a] font-medium"
                >
                  {{ filterProgram }}
                  <button @click="filterProgram = ''" class="hover:text-red-500">×</button>
                </span>
                <button
                  @click="clearFilters"
                  class="ml-auto text-xs text-gray-400 hover:text-red-500 transition-colors"
                >
                  Limpiar todo
                </button>
              </div>
            </div>

            <!-- ── Cards resumen ── -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div
                class="relative overflow-hidden rounded-2xl border border-[#04395a]/10 bg-gradient-to-br from-[#04395a] to-[#068ab8] p-4 text-white"
              >
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs font-medium bg-white/20 px-2 py-0.5 rounded-full"
                    >Total</span
                  >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="currentColor"
                    class="w-4 h-4 opacity-60"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
                    />
                  </svg>
                </div>
                <p class="text-3xl font-bold">{{ bTotal }}</p>
                <p class="text-xs text-white/70 mt-0.5">Fichas en total</p>
                <div class="absolute -right-3 -bottom-3 w-16 h-16 rounded-full bg-white/5" />
              </div>

              <div
                class="relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-emerald-100/60 p-4 cursor-pointer select-none"
                @click="showCompleted = !showCompleted"
                title="Clic para revelar"
              >
                <div class="flex items-center justify-between mb-2">
                  <span
                    class="text-xs font-medium text-emerald-700 bg-emerald-500/10 px-2 py-0.5 rounded-full"
                    >Completadas</span
                  >
                  <svg
                    v-if="showCompleted"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="#10b981"
                    class="w-4 h-4"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                  <svg
                    v-else
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="#10b981"
                    class="w-4 h-4 opacity-50"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                </div>
                <p v-if="showCompleted" class="text-3xl font-bold text-emerald-700">{{ bCompleted }}</p>
                <p v-else class="text-3xl font-bold text-emerald-300 tracking-widest">••••</p>
                <p class="text-xs text-emerald-600/70 mt-0.5">Bautizados</p>
                <div class="absolute -right-3 -bottom-3 w-16 h-16 rounded-full bg-emerald-500/5" />
              </div>

              <div
                class="relative overflow-hidden rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-amber-100/60 p-4 cursor-pointer select-none"
                @click="showDraft = !showDraft"
                title="Clic para revelar"
              >
                <div class="flex items-center justify-between mb-2">
                  <span
                    class="text-xs font-medium text-amber-700 bg-amber-500/10 px-2 py-0.5 rounded-full"
                    >Pendientes</span
                  >
                  <svg
                    v-if="showDraft"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="#f59e0b"
                    class="w-4 h-4"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                  <svg
                    v-else
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="#f59e0b"
                    class="w-4 h-4 opacity-50"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                </div>
                <p v-if="showDraft" class="text-3xl font-bold text-amber-700">{{ bDraft }}</p>
                <p v-else class="text-3xl font-bold text-amber-300 tracking-widest">••••</p>
                <p class="text-xs text-amber-600/70 mt-0.5">Borradores</p>
                <div class="absolute -right-3 -bottom-3 w-16 h-16 rounded-full bg-amber-500/5" />
              </div>
            </div>

            <!-- Progress bar -->
            <div
              class="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 flex items-center gap-4"
            >
              <div class="flex-1">
                <div class="flex items-center justify-between mb-1.5">
                  <span class="text-xs text-gray-500">Avance bautismos</span>
                  <span
                    class="text-xs font-bold"
                    :class="bPct === 100 ? 'text-emerald-600' : 'text-[#04395a]'"
                    >{{ bPct }}%</span
                  >
                </div>
                <div class="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all duration-700 ease-out"
                    :class="
                      bPct === 100
                        ? 'bg-emerald-500'
                        : 'bg-gradient-to-r from-[#04395a] to-[#068ab8]'
                    "
                    :style="{ width: bPct + '%' }"
                  />
                </div>
              </div>
              <button
                type="button"
                @click="loadBaptism"
                class="flex items-center gap-1 text-xs text-[#04395a] hover:text-[#068ab8] font-medium transition-colors shrink-0"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="2"
                  stroke="currentColor"
                  class="w-3.5 h-3.5"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
                  />
                </svg>
                Actualizar
              </button>
            </div>

            <!-- ── Gráficas ── -->
            <div v-if="bTotal > 0" class="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <!-- Por Campus -->
              <div class="rounded-2xl border border-gray-100 bg-white p-4">
                <p class="text-xs font-semibold text-gray-600 mb-3">Por Campus / Sede</p>
                <div class="h-48">
                  <Bar :data="chartCampus" :options="chartOpts" />
                </div>
              </div>

              <!-- Por Facultad -->
              <div class="rounded-2xl border border-gray-100 bg-white p-4">
                <p class="text-xs font-semibold text-gray-600 mb-3">Por Facultad</p>
                <div class="h-48">
                  <Bar :data="chartFaculty" :options="chartOpts" />
                </div>
              </div>

              <!-- Por EP -->
              <div class="rounded-2xl border border-gray-100 bg-white p-4">
                <p class="text-xs font-semibold text-gray-600 mb-3">Por Escuela Profesional</p>
                <div class="h-48">
                  <Bar :data="chartProgram" :options="chartOpts" />
                </div>
              </div>
            </div>

            <!-- ── Tabla candidatos ── -->
            <div class="rounded-2xl border border-gray-100 overflow-hidden">
              <!-- Header -->
              <div
                class="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-3 flex-wrap"
              >
                <div class="flex items-center gap-3">
                  <p class="text-xs font-semibold text-gray-600">
                    Detalle de candidatos
                    <span class="ml-1.5 text-gray-400 font-normal">({{ bTotal }})</span>
                  </p>
                  <!-- Tipo legend -->
                  <div class="hidden sm:flex items-center gap-2">
                    <span
                      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 font-medium"
                    >
                      <span class="w-1.5 h-1.5 rounded-full bg-blue-500" />Alumno
                    </span>
                    <span
                      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-50 text-purple-700 font-medium"
                    >
                      <span class="w-1.5 h-1.5 rounded-full bg-purple-500" />Docente
                    </span>
                    <span
                      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600 font-medium"
                    >
                      <span class="w-1.5 h-1.5 rounded-full bg-gray-400" />Libre
                    </span>
                  </div>
                </div>
                <!-- Export buttons -->
                <div v-if="canWrite" class="flex items-center gap-2">
                  <button
                    type="button"
                    @click="exportExcel"
                    :disabled="bTotal === 0"
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke-width="1.8"
                      stroke="currentColor"
                      class="w-3.5 h-3.5"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
                      />
                    </svg>
                    Excel
                  </button>
                  <button
                    type="button"
                    @click="exportPdf"
                    :disabled="bTotal === 0"
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke-width="1.8"
                      stroke="currentColor"
                      class="w-3.5 h-3.5"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                      />
                    </svg>
                    PDF
                  </button>
                </div>
              </div>

              <!-- Empty -->
              <div v-if="bTotal === 0" class="py-12 text-center">
                <p class="text-sm text-gray-400">No hay candidatos con los filtros aplicados.</p>
              </div>

              <!-- Table -->
              <div v-else class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b border-gray-100 bg-gray-50/50">
                      <th
                        class="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide py-2.5 px-4 w-8"
                      >
                        #
                      </th>
                      <th
                        class="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide py-2.5 px-4"
                      >
                        Tipo
                      </th>
                      <th
                        class="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide py-2.5 px-4"
                      >
                        Nombre
                      </th>
                      <th
                        class="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide py-2.5 px-4"
                      >
                        DNI / Código
                      </th>
                      <th
                        class="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide py-2.5 px-4"
                      >
                        Teléfono
                      </th>
                      <th
                        class="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide py-2.5 px-4 hidden md:table-cell"
                      >
                        Sede
                      </th>
                      <th
                        class="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide py-2.5 px-4 hidden lg:table-cell"
                      >
                        EP / Facultad
                      </th>
                      <th
                        class="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide py-2.5 px-4"
                      >
                        Estado
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="(row, i) in baptismPaged"
                      :key="row.id"
                      class="border-b border-gray-50 hover:bg-gray-50/70 transition-colors"
                    >
                      <td class="py-2.5 px-4 text-xs text-gray-400">{{ (baptismPage - 1) * PAGE_SIZE + i + 1 }}</td>
                      <!-- Tipo badge -->
                      <td class="py-2.5 px-4">
                        <span
                          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                          :class="{
                            'bg-blue-50 text-blue-700': !!row.students,
                            'bg-purple-50 text-purple-700': !!row.teachers && !row.students,
                            'bg-gray-100 text-gray-600': !row.students && !row.teachers,
                          }"
                        >
                          <span
                            class="w-1.5 h-1.5 rounded-full"
                            :class="{
                              'bg-blue-500': !!row.students,
                              'bg-purple-500': !!row.teachers && !row.students,
                              'bg-gray-400': !row.students && !row.teachers,
                            }"
                          />
                          {{ rowType(row) }}
                        </span>
                      </td>
                      <td class="py-2.5 px-4 font-medium text-gray-800">{{ rowName(row) }}</td>
                      <td class="py-2.5 px-4 font-mono text-xs text-gray-500">{{ rowDni(row) }}</td>
                      <td class="py-2.5 px-4 text-xs text-gray-500">{{ rowPhone(row) }}</td>
                      <td class="py-2.5 px-4 text-xs text-gray-500 hidden md:table-cell">
                        {{ rowCampus(row) || '—' }}
                      </td>
                      <td class="py-2.5 px-4 text-xs text-gray-500 hidden lg:table-cell">
                        <span>{{ rowProgram(row) || '—' }}</span>
                        <span v-if="rowFaculty(row)" class="block text-gray-400">{{
                          rowFaculty(row)
                        }}</span>
                      </td>
                      <td class="py-2.5 px-4">
                        <span
                          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                          :class="
                            row.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          "
                        >
                          <span
                            class="w-1.5 h-1.5 rounded-full"
                            :class="row.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-400'"
                          />
                          {{ row.status === 'completed' ? 'Bautizado' : 'Pendiente' }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <!-- Paginación -->
                <div
                  v-if="baptismTotalPages > 1"
                  class="flex items-center justify-between px-4 py-3 border-t border-gray-100"
                >
                  <p class="text-xs text-gray-400">
                    {{ (baptismPage - 1) * PAGE_SIZE + 1 }}–{{ Math.min(baptismPage * PAGE_SIZE, bTotal) }}
                    de {{ bTotal }}
                  </p>
                  <div class="flex items-center gap-1">
                    <button
                      type="button"
                      :disabled="baptismPage === 1"
                      @click="baptismPage--"
                      class="px-2.5 py-1 rounded-lg text-xs font-medium border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      ‹ Anterior
                    </button>
                    <span class="px-3 py-1 text-xs text-gray-600 font-medium">
                      {{ baptismPage }} / {{ baptismTotalPages }}
                    </span>
                    <button
                      type="button"
                      :disabled="baptismPage === baptismTotalPages"
                      @click="baptismPage++"
                      class="px-2.5 py-1 rounded-lg text-xs font-medium border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Siguiente ›
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- ══ OTROS TABS ══════════════════════════════════════════════════════ -->
        <template
          v-for="tab in tabs.filter((t) => t.key !== 'today' && t.key !== 'baptism')"
          :key="tab.key"
        >
          <div v-if="activeTab === tab.key">
            <div v-if="tab.key === 'export'" class="pt-2 space-y-4">
              <div
                v-if="!canWrite"
                class="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="#d97706"
                  class="w-5 h-5 shrink-0"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
                  />
                </svg>
                <p class="text-sm text-amber-800">
                  Tu rol de Visualizador no tiene permisos para exportar datos.
                </p>
              </div>
              <p v-else class="text-xs text-gray-400">
                Descarga los datos del sistema en formato Excel.
              </p>
              <div v-if="canWrite" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  v-for="label in ['Estudiantes', 'Candidatos', 'Candidatos por Sede']"
                  :key="label"
                  type="button"
                  disabled
                  class="flex items-center gap-3 p-4 bg-gray-50 rounded-xl text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div
                    class="w-8 h-8 rounded-lg bg-[#04395a]/8 flex items-center justify-center shrink-0"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke-width="1.5"
                      stroke="#04395a"
                      class="w-4 h-4"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
                      />
                    </svg>
                  </div>
                  <div>
                    <p class="text-sm font-medium text-gray-700">{{ label }}</p>
                    <p class="text-xs text-gray-400">.xlsx</p>
                  </div>
                </button>
              </div>
            </div>
            <div v-else class="flex flex-col items-center justify-center py-20 text-center">
              <div class="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.3"
                  stroke="#04395a"
                  class="w-6 h-6"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
                  />
                </svg>
              </div>
              <p class="text-sm font-medium text-gray-500">{{ tab.label }}</p>
              <p class="text-xs text-gray-400 mt-1">
                Disponible cuando haya candidatos registrados.
              </p>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
