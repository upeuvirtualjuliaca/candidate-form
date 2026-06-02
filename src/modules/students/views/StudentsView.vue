<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Tabs, { type Tab } from '@/components/ui/Tabs.vue'
import {
  getStudentsPaginated,
  getLibrePaginated,
  searchStudents,
  searchLibre,
  createStudent,
  getStudentDetail,
  createCandidateFromStudent,
  createPersonAndCandidate,
  getCandidateMapForStudents,
  getStudentCatalog,
  type Student,
  type StudentDetail,
  type CatalogEntry,
} from '../services/students.service'
import {
  getTeachersPaginated,
  searchTeachers,
  createTeacher,
  getCandidateMapForTeachers,
  createCandidateFromTeacher,
  type Teacher,
} from '@/modules/teachers/services/teachers.service'

import { useCampaignStore } from '@/modules/campaigns/store/campaign.store'

const router = useRouter()
const campaignStore = useCampaignStore()

// ── Tabs ───────────────────────────────────────────────────────────────────
const tabs: Tab[] = [
  { key: 'list', label: 'Listado' },
  { key: 'search', label: 'Buscar' },
  { key: 'new', label: 'Nuevo' },
]
const activeTab = ref('list')

// ── PAGE SIZE OPTIONS ──────────────────────────────────────────────────────
const pageSizeOptions = [10, 25, 50] as const
type PageSize = (typeof pageSizeOptions)[number]

// ═══════════════════════════════════════════════════════════════════════════
// TAB 1 — LISTADO
// ═══════════════════════════════════════════════════════════════════════════
type ListSource = 'students' | 'teachers' | 'libre'
const listSource = ref<ListSource>('students')

const listRows = ref<Student[]>([])
const teacherRows = ref<Teacher[]>([])
const libreRows = ref<Student[]>([])
const listCount = ref(0)
const listPage = ref(1)
const listPageSize = ref<PageSize>(10)
const listLoading = ref(false)
const listError = ref('')

const listTotalPages = computed(() => Math.max(1, Math.ceil(listCount.value / listPageSize.value)))
const listFrom = computed(() => (listPage.value - 1) * listPageSize.value + 1)
const listTo = computed(() => Math.min(listPage.value * listPageSize.value, listCount.value))

// Mapas de candidatos
const candidateMap = ref<Record<string, string>>({})
const teacherCandidateMap = ref<Record<string, string>>({})

async function loadCandidateMap(students: Student[]) {
  const ids = students.map((s) => s.id)
  const map = await getCandidateMapForStudents(ids)
  candidateMap.value = { ...candidateMap.value, ...map }
}

async function loadTeacherCandidateMap(teachers: Teacher[]) {
  const ids = teachers.map((t) => t.id)
  const map = await getCandidateMapForTeachers(ids)
  teacherCandidateMap.value = { ...teacherCandidateMap.value, ...map }
}

async function loadList() {
  listLoading.value = true
  listError.value = ''
  try {
    if (listSource.value === 'teachers') {
      const res = await getTeachersPaginated(listPage.value, listPageSize.value)
      teacherRows.value = res.data
      listCount.value = res.count
      await loadTeacherCandidateMap(res.data)
    } else if (listSource.value === 'libre') {
      const res = await getLibrePaginated(listPage.value, listPageSize.value)
      libreRows.value = res.data
      listCount.value = res.count
      await loadCandidateMap(res.data)
    } else {
      const res = await getStudentsPaginated(listPage.value, listPageSize.value)
      listRows.value = res.data
      listCount.value = res.count
      await loadCandidateMap(res.data)
    }
  } catch (err) {
    listError.value = err instanceof Error ? err.message : 'Error al cargar registros.'
  } finally {
    listLoading.value = false
  }
}

function goToPage(p: number) {
  if (p < 1 || p > listTotalPages.value) return
  listPage.value = p
}

function switchListSource(src: ListSource) {
  if (listSource.value === src) return
  listSource.value = src
  listPage.value = 1
  listCount.value = 0
  listRows.value = []
  teacherRows.value = []
  libreRows.value = []
  loadList()
}

watch([listPage, listPageSize], loadList)
onMounted(loadList)

// ═══════════════════════════════════════════════════════════════════════════
// TAB 2 — BUSCAR
// ═══════════════════════════════════════════════════════════════════════════
const searchQuery = ref('')
const searchResults = ref<Student[]>([])
const teacherSearchResults = ref<Teacher[]>([])
const libreSearchResults = ref<Student[]>([])
const searchLoading = ref(false)
const searchError = ref('')
const searchDone = ref(false)
const showCreateTypeSelector = ref(false)

const isSearchDni = computed(() => /^\d+$/.test(searchQuery.value.trim()))

const hasAnySearchResults = computed(
  () =>
    searchResults.value.length > 0 ||
    teacherSearchResults.value.length > 0 ||
    libreSearchResults.value.length > 0,
)

let debounceTimer: ReturnType<typeof setTimeout> | null = null

function triggerSearch() {
  if (debounceTimer) clearTimeout(debounceTimer)
  showCreateTypeSelector.value = false
  const q = searchQuery.value.trim()
  const valid = /^\d+$/.test(q) ? q.length >= 4 : q.length >= 2

  if (!valid) {
    searchResults.value = []
    teacherSearchResults.value = []
    libreSearchResults.value = []
    searchDone.value = false
    return
  }
  debounceTimer = setTimeout(runSearch, 400)
}

async function runSearch() {
  searchLoading.value = true
  searchError.value = ''
  searchDone.value = false
  const q = searchQuery.value.trim()
  const isDni = /^\d+$/.test(q)
  const params = isDni ? { dni: q } : { name: q }
  try {
    const [students, teachers, libre] = await Promise.all([
      searchStudents(params),
      searchTeachers(params),
      searchLibre(params),
    ])
    searchResults.value = students
    teacherSearchResults.value = teachers
    libreSearchResults.value = libre
    searchDone.value = true
    await Promise.all([
      loadCandidateMap([...students, ...libre]),
      loadTeacherCandidateMap(teachers),
    ])
  } catch (err) {
    searchError.value = err instanceof Error ? err.message : 'Error en la búsqueda.'
  } finally {
    searchLoading.value = false
  }
}

/** Navega a la pestaña Nuevo pre-llenando el formulario correspondiente. */
function goToNewWithQuery(type: ListSource) {
  const q = searchQuery.value.trim()
  const isDni = /^\d+$/.test(q)
  newSource.value = type
  if (type === 'students') {
    resetStudentForm()
    if (isDni) {
      nsDocId.value = q
    } else {
      nsFullName.value = q
    }
  } else if (type === 'teachers') {
    resetTeacherForm()
    if (isDni) {
      ntDni.value = q
    } else {
      ntFullName.value = q
    }
  } else {
    // libre: pre-llenar según tipo de dato
    if (isDni) {
      newDni.value = q
      newFullName.value = ''
    } else {
      newFullName.value = q
      newDni.value = ''
    }
  }
  showCreateTypeSelector.value = false
  activeTab.value = 'new'
}

watch(searchQuery, triggerSearch)

// ═══════════════════════════════════════════════════════════════════════════
// ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

// — Create candidate ────────────────────────────────────────────────────────
const creatingId = ref<string | null>(null)

async function handleCreateCandidate(student: Student | StudentDetail) {
  // Si ya tiene ficha, redirigir con aviso de duplicado
  if (candidateMap.value[student.id]) {
    router.push({ path: `/candidates/${candidateMap.value[student.id]}`, query: { dup: '1' } })
    return
  }
  const campaignCheck = campaignStore.checkValidity()
  if (!campaignCheck.allowed) {
    campaignStore.notify('No se puede crear la ficha', campaignCheck.reason, 'error')
    return
  }
  if (creatingId.value) return
  creatingId.value = student.id
  try {
    const { id: candidateId, existed } = await createCandidateFromStudent(student.id, campaignStore.selected?.id ?? null)
    candidateMap.value[student.id] = candidateId
    router.push({
      path: `/candidates/${candidateId}`,
      query: existed ? { dup: '1' } : { new: '1' },
    })
  } catch (err) {
    alert(err instanceof Error ? err.message : 'No se pudo crear la ficha.')
    creatingId.value = null
  }
}

async function handleCreateTeacherCandidate(teacher: Teacher) {
  if (teacherCandidateMap.value[teacher.id]) {
    router.push({
      path: `/candidates/${teacherCandidateMap.value[teacher.id]}`,
      query: { dup: '1' },
    })
    return
  }
  const campaignCheck = campaignStore.checkValidity()
  if (!campaignCheck.allowed) {
    campaignStore.notify('No se puede crear la ficha', campaignCheck.reason, 'error')
    return
  }
  if (creatingId.value) return
  creatingId.value = teacher.id
  try {
    const { id: candidateId, existed } = await createCandidateFromTeacher(teacher.id, campaignStore.selected?.id ?? null)
    teacherCandidateMap.value[teacher.id] = candidateId
    router.push({
      path: `/candidates/${candidateId}`,
      query: existed ? { dup: '1' } : { new: '1' },
    })
  } catch (err) {
    alert(err instanceof Error ? err.message : 'No se pudo crear la ficha.')
    creatingId.value = null
  }
}

// — Detail modal ────────────────────────────────────────────────────────────
const modalOpen = ref(false)
const modalStudent = ref<StudentDetail | null>(null)
const modalLoading = ref(false)
const modalError = ref('')

async function openDetail(student: Student) {
  modalOpen.value = true
  modalLoading.value = true
  modalStudent.value = null
  modalError.value = ''
  try {
    modalStudent.value = await getStudentDetail(student.id)
  } catch (err) {
    modalError.value = err instanceof Error ? err.message : 'Error al cargar detalle.'
  } finally {
    modalLoading.value = false
  }
}

function closeModal() {
  modalOpen.value = false
  modalStudent.value = null
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 3 — NUEVO
// ═══════════════════════════════════════════════════════════════════════════
const newSource = ref<ListSource>('libre')

// — Catálogo Campus → Facultad → Programa ──────────────────────────────
const catalog = ref<CatalogEntry[]>([])
const catalogLoading = ref(false)
let catalogLoaded = false

async function loadCatalog() {
  if (catalogLoaded) return
  catalogLoading.value = true
  try {
    catalog.value = await getStudentCatalog()
    catalogLoaded = true
  } catch {
    /* campos quedarán libres */
  } finally {
    catalogLoading.value = false
  }
}

const campusOptions = computed(() => [...new Set(catalog.value.map((e) => e.campus))].sort())
const facultyOptions = computed(() =>
  [
    ...new Set(
      catalog.value
        .filter((e) => !nsCampus.value || e.campus === nsCampus.value)
        .map((e) => e.faculty),
    ),
  ].sort(),
)
const programOptions = computed(() =>
  [
    ...new Set(
      catalog.value
        .filter(
          (e) =>
            (!nsCampus.value || e.campus === nsCampus.value) &&
            (!nsFaculty.value || e.faculty === nsFaculty.value),
        )
        .map((e) => e.program),
    ),
  ].sort(),
)

// — Formulario crear Estudiante ──────────────────────────────────────────
const nsFullName = ref('')
const nsDocId = ref('')
const nsSex = ref('')
const nsBirthDate = ref('')
const nsPhone = ref('')
const nsEmail = ref('')
const nsProgram = ref('')
const nsFaculty = ref('')
const nsCampus = ref('')
const nsCycle = ref('')
const nsSaving = ref(false)
const nsError = ref('')
const nsValid = computed(
  () => nsFullName.value.trim().length >= 3 && nsDocId.value.trim().length >= 6,
)

// Limpiar campos dependientes en cascada
watch(nsCampus, () => {
  nsFaculty.value = ''
  nsProgram.value = ''
})
watch(nsFaculty, () => {
  nsProgram.value = ''
})

function resetStudentForm() {
  nsFullName.value = nsDocId.value = nsSex.value = nsBirthDate.value = ''
  nsPhone.value = nsEmail.value = nsProgram.value = nsFaculty.value = ''
  nsCampus.value = nsCycle.value = nsError.value = ''
}

async function handleCreateStudent() {
  if (!nsValid.value || nsSaving.value) return
  const campaignCheck = campaignStore.checkValidity()
  if (!campaignCheck.allowed) {
    campaignStore.notify('No se puede crear la ficha', campaignCheck.reason, 'error')
    return
  }
  nsSaving.value = true
  nsError.value = ''
  try {
    const student = await createStudent({
      full_name: nsFullName.value.trim(),
      dni: nsDocId.value.trim(),
      sex: nsSex.value || null,
      birth_date: nsBirthDate.value || null,
      phone: nsPhone.value || null,
      institutional_email: nsEmail.value || null,
      program: nsProgram.value || null,
      faculty: nsFaculty.value || null,
      campus: nsCampus.value || null,
      cycle: nsCycle.value || null,
    })
    const { id: candidateId, existed } = await createCandidateFromStudent(student.id, campaignStore.selected?.id ?? null)
    candidateMap.value[student.id] = candidateId
    router.push({
      path: `/candidates/${candidateId}`,
      query: existed ? { dup: '1' } : { new: '1' },
    })
  } catch (err) {
    nsError.value = err instanceof Error ? err.message : 'No se pudo crear el estudiante.'
    nsSaving.value = false
  }
}

// — Formulario crear Docente ─────────────────────────────────────────────
const ntFullName = ref('')
const ntDni = ref('')
const ntDocType = ref('')
const ntAcademicDegree = ref('')
const ntDedicationRegime = ref('')
const ntLaborCondition = ref('')
const ntFaculty = ref('')
const ntMainEp = ref('')
const ntCampus = ref('')
const ntCondition = ref('')
const ntSaving = ref(false)
const ntError = ref('')
const ntValid = computed(
  () => ntFullName.value.trim().length >= 3 && ntDni.value.trim().length >= 6,
)

function resetTeacherForm() {
  ntFullName.value = ntDni.value = ntDocType.value = ntAcademicDegree.value = ''
  ntDedicationRegime.value = ntLaborCondition.value = ntFaculty.value = ''
  ntMainEp.value = ntCampus.value = ntCondition.value = ntError.value = ''
}

async function handleCreateTeacher() {
  if (!ntValid.value || ntSaving.value) return
  const campaignCheck = campaignStore.checkValidity()
  if (!campaignCheck.allowed) {
    campaignStore.notify('No se puede crear la ficha', campaignCheck.reason, 'error')
    return
  }
  ntSaving.value = true
  ntError.value = ''
  try {
    const teacher = await createTeacher({
      full_name: ntFullName.value.trim(),
      dni: ntDni.value.trim(),
      doc_type: ntDocType.value || null,
      academic_degree: ntAcademicDegree.value || null,
      dedication_regime: ntDedicationRegime.value || null,
      labor_condition: ntLaborCondition.value || null,
      faculty: ntFaculty.value || null,
      main_ep: ntMainEp.value || null,
      campus: ntCampus.value || null,
      condition: ntCondition.value || null,
    })
    const { id: candidateId, existed } = await createCandidateFromTeacher(teacher.id, campaignStore.selected?.id ?? null)
    teacherCandidateMap.value[teacher.id] = candidateId
    router.push({
      path: `/candidates/${candidateId}`,
      query: existed ? { dup: '1' } : { new: '1' },
    })
  } catch (err) {
    ntError.value = err instanceof Error ? err.message : 'No se pudo crear el docente.'
    ntSaving.value = false
  }
}

// Limpiar formularios al cambiar de fuente y cargar catálogo si es necesario
watch(newSource, (src) => {
  if (src === 'students') {
    resetStudentForm()
    loadCatalog()
  } else if (src === 'teachers') resetTeacherForm()
})

// — Formulario Libre ─────────────────────────────────────────────────────
const newFullName = ref('')
const newDni = ref('')
const newSex = ref<'1' | '2' | ''>('')
const newBirthDate = ref('')
const newPhone = ref('')
const newEmail = ref('')
const newSaving = ref(false)
const newError = ref('')

const newFormValid = computed(
  () => newFullName.value.trim().length >= 3 && newDni.value.trim().length >= 6,
)

async function handleCreatePerson() {
  if (!newFormValid.value || newSaving.value) return
  const campaignCheck = campaignStore.checkValidity()
  if (!campaignCheck.allowed) {
    campaignStore.notify('No se puede crear la ficha', campaignCheck.reason, 'error')
    return
  }
  newSaving.value = true
  newError.value = ''
  try {
    const { id: candidateId, existed } = await createPersonAndCandidate({
      full_name: newFullName.value,
      dni: newDni.value,
      sex: (newSex.value as '1' | '2') || null,
      birth_date: newBirthDate.value || null,
      phone: newPhone.value || null,
      institutional_email: newEmail.value || null,
    }, campaignStore.selected?.id ?? null)
    router.push({
      path: `/candidates/${candidateId}`,
      query: existed ? { dup: '1' } : { new: '1' },
    })
  } catch (err) {
    newError.value = err instanceof Error ? err.message : 'No se pudo crear la ficha.'
  } finally {
    newSaving.value = false
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────
function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

function programBadge(p: string | null): string {
  if (!p) return 'bg-gray-100 text-gray-500'
  const h = [...p].reduce((a, c) => a + c.charCodeAt(0), 0)
  const colors = [
    'bg-blue-50 text-blue-700',
    'bg-violet-50 text-violet-700',
    'bg-teal-50 text-teal-700',
    'bg-rose-50 text-rose-700',
    'bg-orange-50 text-orange-700',
    'bg-cyan-50 text-cyan-700',
  ]
  return colors[h % colors.length] ?? 'bg-gray-100 text-gray-500'
}
</script>

<template>
  <div class="space-y-6">
    <!-- Heading -->
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div>
        <h2 class="text-2xl font-bold text-[#04395a]">Candidatos</h2>
        <p class="text-sm text-gray-500 mt-0.5">
          Consulta, búsqueda y creación de fichas de candidatos.
        </p>
      </div>
      <span
        v-if="listCount > 0"
        class="px-3 py-1.5 bg-[#04395a]/8 rounded-xl text-xs font-semibold text-[#04395a]"
      >
        {{ listCount.toLocaleString() }} registros
      </span>
    </div>

    <!-- Card -->
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="px-6 pt-4">
        <Tabs v-model="activeTab" :tabs="tabs" />
      </div>

      <div class="px-6 pb-6">
        <!-- ════════════════════════════════════════════════════════════════
             TAB: LISTADO
        ════════════════════════════════════════════════════════════════ -->
        <div v-show="activeTab === 'list'" class="mt-4 space-y-4">
          <!-- Source selector -->
          <div class="flex items-center gap-2">
            <button
              v-for="src in [
                { key: 'students', label: 'Estudiantes' },
                { key: 'teachers', label: 'Docentes' },
                { key: 'libre', label: 'Libre' },
              ] as const"
              :key="src.key"
              type="button"
              @click="switchListSource(src.key)"
              :class="[
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                listSource === src.key
                  ? 'bg-[#04395a] text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
              ]"
            >
              {{ src.label }}
            </button>
          </div>

          <!-- Error -->
          <div
            v-if="listError"
            class="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.8"
              stroke="#ef4444"
              class="w-5 h-5 shrink-0"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
              />
            </svg>
            <p class="text-sm text-red-700 flex-1">{{ listError }}</p>
            <button
              type="button"
              @click="loadList"
              class="text-xs font-medium text-red-700 underline underline-offset-2"
            >
              Reintentar
            </button>
          </div>

          <!-- Skeleton -->
          <div v-else-if="listLoading" class="space-y-2">
            <div
              v-for="i in listPageSize"
              :key="i"
              class="h-12 bg-gray-100 rounded-xl animate-pulse"
              :style="{ opacity: 1 - i * 0.06 }"
            />
          </div>

          <!-- Empty state -->
          <div
            v-else-if="
              (listSource === 'students'
                ? listRows
                : listSource === 'teachers'
                  ? teacherRows
                  : libreRows
              ).length === 0 && !listError
            "
            class="flex flex-col items-center justify-center py-20 text-center"
          >
            <div class="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.3"
                stroke="#9ca3af"
                class="w-6 h-6"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
                />
              </svg>
            </div>
            <p class="text-sm font-medium text-gray-500">
              Sin
              {{
                listSource === 'students'
                  ? 'estudiantes'
                  : listSource === 'teachers'
                    ? 'docentes'
                    : 'personas libres'
              }}
              registrados
            </p>
            <p v-if="listSource !== 'libre'" class="text-xs text-gray-400 mt-1">
              Importa un Excel desde
              <RouterLink
                :to="listSource === 'students' ? '/admission' : '/teachers-import'"
                class="text-[#068ab8] underline underline-offset-2"
                >{{ listSource === 'students' ? 'Admisión' : 'Docentes' }}</RouterLink
              >.
            </p>
            <p v-else class="text-xs text-gray-400 mt-1">
              Crea personas libres desde la pestaña <strong>Nuevo</strong>.
            </p>
          </div>

          <!-- Table -->
          <template v-else>
            <!-- ── ESTUDIANTES ─────────────────────────────────────────── -->
            <template v-if="listSource === 'students'">
              <div
                class="hidden lg:grid grid-cols-[1fr_2fr_2fr_1.5fr_1.2fr_0.8fr_auto] gap-3 px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide"
              >
                <span>DNI</span><span>Nombre completo</span><span>Programa</span>
                <span>Facultad</span><span>Sede</span><span>Ciclo</span><span>Acciones</span>
              </div>
              <div class="space-y-2">
                <div
                  v-for="student in listRows"
                  :key="student.id"
                  class="group bg-gray-50 hover:bg-[#04395a]/3 rounded-xl transition-colors duration-150"
                >
                  <!-- Desktop -->
                  <div
                    class="hidden lg:grid grid-cols-[1fr_2fr_2fr_1.5fr_1.2fr_0.8fr_auto] gap-3 items-center px-4 py-3.5"
                  >
                    <span class="text-sm font-mono text-gray-600">{{ student.dni }}</span>
                    <span class="text-sm font-medium text-gray-800 truncate">{{
                      student.full_name
                    }}</span>
                    <span
                      v-if="student.program"
                      :class="[
                        'text-xs font-medium px-2.5 py-1 rounded-lg truncate w-fit max-w-full',
                        programBadge(student.program),
                      ]"
                      :title="student.program"
                      >{{ student.program }}</span
                    >
                    <span v-else class="text-xs text-gray-300">—</span>
                    <span class="text-sm text-gray-500 truncate">{{ student.faculty ?? '—' }}</span>
                    <span class="text-sm text-gray-500">{{ student.campus ?? '—' }}</span>
                    <span class="text-sm text-gray-500">{{ student.cycle ?? '—' }}</span>
                    <div class="flex items-center gap-1.5">
                      <button
                        type="button"
                        @click="openDetail(student)"
                        class="p-1.5 rounded-lg text-gray-400 hover:text-[#04395a] hover:bg-white transition-colors"
                        title="Ver detalle"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke-width="1.8"
                          stroke="currentColor"
                          class="w-4 h-4"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178Z"
                          />
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                          />
                        </svg>
                      </button>
                      <RouterLink
                        v-if="candidateMap[student.id]"
                        :to="`/candidates/${candidateMap[student.id]}`"
                        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#068ab8] bg-blue-50 hover:bg-blue-100 transition-colors whitespace-nowrap"
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
                            d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125"
                          />
                        </svg>
                        Editar Ficha
                      </RouterLink>
                      <button
                        v-else
                        type="button"
                        :disabled="creatingId === student.id"
                        @click="handleCreateCandidate(student)"
                        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-[#04395a] hover:bg-[#068ab8] transition-colors disabled:opacity-50 whitespace-nowrap"
                      >
                        <svg
                          v-if="creatingId !== student.id"
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
                            d="M12 4.5v15m7.5-7.5h-15"
                          />
                        </svg>
                        <svg
                          v-else
                          class="w-3.5 h-3.5 animate-spin"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            class="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            stroke-width="4"
                          />
                          <path
                            class="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                          />
                        </svg>
                        Crear Ficha
                      </button>
                    </div>
                  </div>
                  <!-- Mobile -->
                  <div class="lg:hidden p-4 space-y-3">
                    <div class="flex items-start justify-between gap-2">
                      <div>
                        <p class="text-sm font-semibold text-gray-800">{{ student.full_name }}</p>
                        <p class="text-xs font-mono text-gray-500 mt-0.5">{{ student.dni }}</p>
                      </div>
                      <span
                        v-if="student.program"
                        :class="[
                          'text-xs font-medium px-2 py-1 rounded-lg shrink-0',
                          programBadge(student.program),
                        ]"
                        >{{ student.cycle ?? '—' }}</span
                      >
                    </div>
                    <div class="text-xs text-gray-400 space-y-0.5">
                      <p v-if="student.faculty">{{ student.faculty }}</p>
                      <p v-if="student.campus">{{ student.campus }}</p>
                      <p v-if="student.program" class="truncate">{{ student.program }}</p>
                    </div>
                    <div class="flex gap-2">
                      <button
                        type="button"
                        @click="openDetail(student)"
                        class="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-[#04395a] bg-[#04395a]/8 hover:bg-[#04395a]/15 transition-colors"
                      >
                        Ver detalle
                      </button>
                      <RouterLink
                        v-if="candidateMap[student.id]"
                        :to="`/candidates/${candidateMap[student.id]}`"
                        class="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-[#068ab8] bg-blue-50 hover:bg-blue-100 transition-colors"
                        >Editar Ficha</RouterLink
                      >
                      <button
                        v-else
                        type="button"
                        :disabled="creatingId === student.id"
                        @click="handleCreateCandidate(student)"
                        class="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-white bg-[#04395a] hover:bg-[#068ab8] transition-colors disabled:opacity-50"
                      >
                        Crear Ficha
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <!-- ── DOCENTES ────────────────────────────────────────────── -->
            <template v-else-if="listSource === 'teachers'">
              <div
                class="hidden lg:grid grid-cols-[1fr_2fr_2fr_1.5fr_1.5fr_auto] gap-3 px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide"
              >
                <span>DNI</span><span>Nombre completo</span><span>Grado académico</span>
                <span>Facultad</span><span>EP Principal</span><span>Acciones</span>
              </div>
              <div class="space-y-2">
                <div
                  v-for="teacher in teacherRows"
                  :key="teacher.id"
                  class="group bg-gray-50 hover:bg-[#04395a]/3 rounded-xl transition-colors duration-150"
                >
                  <!-- Desktop -->
                  <div
                    class="hidden lg:grid grid-cols-[1fr_2fr_2fr_1.5fr_1.5fr_auto] gap-3 items-center px-4 py-3.5"
                  >
                    <span class="text-sm font-mono text-gray-600">{{ teacher.dni }}</span>
                    <span class="text-sm font-medium text-gray-800 truncate">{{
                      teacher.full_name
                    }}</span>
                    <span class="text-xs text-gray-500 truncate">{{
                      teacher.academic_degree ?? '—'
                    }}</span>
                    <span class="text-sm text-gray-500 truncate">{{ teacher.faculty ?? '—' }}</span>
                    <span class="text-sm text-gray-500 truncate">{{ teacher.main_ep ?? '—' }}</span>
                    <div class="flex items-center gap-1.5">
                      <RouterLink
                        v-if="teacherCandidateMap[teacher.id]"
                        :to="`/candidates/${teacherCandidateMap[teacher.id]}`"
                        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#068ab8] bg-blue-50 hover:bg-blue-100 transition-colors whitespace-nowrap"
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
                            d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125"
                          />
                        </svg>
                        Editar Ficha
                      </RouterLink>
                      <button
                        v-else
                        type="button"
                        :disabled="creatingId === teacher.id"
                        @click="handleCreateTeacherCandidate(teacher)"
                        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-[#04395a] hover:bg-[#068ab8] transition-colors disabled:opacity-50 whitespace-nowrap"
                      >
                        <svg
                          v-if="creatingId !== teacher.id"
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
                            d="M12 4.5v15m7.5-7.5h-15"
                          />
                        </svg>
                        <svg
                          v-else
                          class="w-3.5 h-3.5 animate-spin"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            class="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            stroke-width="4"
                          />
                          <path
                            class="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                          />
                        </svg>
                        Crear Ficha
                      </button>
                    </div>
                  </div>
                  <!-- Mobile -->
                  <div class="lg:hidden p-4 space-y-3">
                    <div>
                      <p class="text-sm font-semibold text-gray-800">{{ teacher.full_name }}</p>
                      <p class="text-xs font-mono text-gray-500 mt-0.5">{{ teacher.dni }}</p>
                    </div>
                    <div class="text-xs text-gray-400 space-y-0.5">
                      <p v-if="teacher.academic_degree">{{ teacher.academic_degree }}</p>
                      <p v-if="teacher.faculty">{{ teacher.faculty }}</p>
                      <p v-if="teacher.main_ep" class="truncate">EP: {{ teacher.main_ep }}</p>
                    </div>
                    <div class="flex gap-2">
                      <RouterLink
                        v-if="teacherCandidateMap[teacher.id]"
                        :to="`/candidates/${teacherCandidateMap[teacher.id]}`"
                        class="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-[#068ab8] bg-blue-50 hover:bg-blue-100 transition-colors"
                        >Editar Ficha</RouterLink
                      >
                      <button
                        v-else
                        type="button"
                        :disabled="creatingId === teacher.id"
                        @click="handleCreateTeacherCandidate(teacher)"
                        class="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-white bg-[#04395a] hover:bg-[#068ab8] transition-colors disabled:opacity-50"
                      >
                        Crear Ficha
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <!-- ── LIBRE ───────────────────────────────────────────────── -->
            <template v-else>
              <div
                class="hidden lg:grid grid-cols-[1fr_2fr_1.5fr_1.5fr_auto] gap-3 px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide"
              >
                <span>DNI</span><span>Nombre completo</span><span>Teléfono</span
                ><span>F. Nacimiento</span><span>Acciones</span>
              </div>
              <div class="space-y-2">
                <div
                  v-for="person in libreRows"
                  :key="person.id"
                  class="group bg-gray-50 hover:bg-[#04395a]/3 rounded-xl transition-colors duration-150"
                >
                  <!-- Desktop -->
                  <div
                    class="hidden lg:grid grid-cols-[1fr_2fr_1.5fr_1.5fr_auto] gap-3 items-center px-4 py-3.5"
                  >
                    <span class="text-sm font-mono text-gray-600">{{ person.dni }}</span>
                    <span class="text-sm font-medium text-gray-800 truncate">{{
                      person.full_name
                    }}</span>
                    <span class="text-sm text-gray-500">{{ person.phone ?? '—' }}</span>
                    <span class="text-sm text-gray-500">{{
                      person.birth_date ? formatDate(person.birth_date) : '—'
                    }}</span>
                    <div class="flex items-center gap-1.5">
                      <RouterLink
                        v-if="candidateMap[person.id]"
                        :to="`/candidates/${candidateMap[person.id]}`"
                        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#068ab8] bg-blue-50 hover:bg-blue-100 transition-colors whitespace-nowrap"
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
                            d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125"
                          />
                        </svg>
                        Editar Ficha
                      </RouterLink>
                      <button
                        v-else
                        type="button"
                        :disabled="creatingId === person.id"
                        @click="handleCreateCandidate(person)"
                        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-[#04395a] hover:bg-[#068ab8] transition-colors disabled:opacity-50 whitespace-nowrap"
                      >
                        <svg
                          v-if="creatingId !== person.id"
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
                            d="M12 4.5v15m7.5-7.5h-15"
                          />
                        </svg>
                        <svg
                          v-else
                          class="w-3.5 h-3.5 animate-spin"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            class="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            stroke-width="4"
                          />
                          <path
                            class="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                          />
                        </svg>
                        Crear Ficha
                      </button>
                    </div>
                  </div>
                  <!-- Mobile -->
                  <div class="lg:hidden p-4 space-y-3">
                    <div>
                      <p class="text-sm font-semibold text-gray-800">{{ person.full_name }}</p>
                      <p class="text-xs font-mono text-gray-500 mt-0.5">{{ person.dni }}</p>
                    </div>
                    <div class="text-xs text-gray-400 space-y-0.5">
                      <p v-if="person.phone">Tel: {{ person.phone }}</p>
                      <p v-if="person.birth_date">Nac: {{ formatDate(person.birth_date) }}</p>
                    </div>
                    <div class="flex gap-2">
                      <RouterLink
                        v-if="candidateMap[person.id]"
                        :to="`/candidates/${candidateMap[person.id]}`"
                        class="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-[#068ab8] bg-blue-50 hover:bg-blue-100 transition-colors"
                        >Editar Ficha</RouterLink
                      >
                      <button
                        v-else
                        type="button"
                        :disabled="creatingId === person.id"
                        @click="handleCreateCandidate(person)"
                        class="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-white bg-[#04395a] hover:bg-[#068ab8] transition-colors disabled:opacity-50"
                      >
                        Crear Ficha
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <!-- Footer: page size + pagination -->
            <div
              class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-gray-100"
            >
              <!-- Page size selector -->
              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-400">Mostrar</span>
                <select
                  v-model="listPageSize"
                  @change="listPage = 1"
                  class="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] bg-white"
                >
                  <option v-for="n in pageSizeOptions" :key="n" :value="n">{{ n }}</option>
                </select>
                <span class="text-xs text-gray-400">por página</span>
                <span v-if="listCount > 0" class="text-xs text-gray-400">
                  · {{ listFrom }}–{{ listTo }} de {{ listCount.toLocaleString() }}
                </span>
              </div>

              <!-- Pagination -->
              <div v-if="listTotalPages > 1" class="flex items-center gap-1">
                <button
                  type="button"
                  :disabled="listPage === 1"
                  @click="goToPage(listPage - 1)"
                  class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="2"
                    stroke="currentColor"
                    class="w-4 h-4"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M15.75 19.5 8.25 12l7.5-7.5"
                    />
                  </svg>
                </button>

                <template v-for="p in listTotalPages" :key="p">
                  <button
                    v-if="p === 1 || p === listTotalPages || Math.abs(p - listPage) <= 1"
                    type="button"
                    @click="goToPage(p)"
                    :class="[
                      'w-8 h-8 rounded-lg text-xs font-medium transition-colors',
                      p === listPage
                        ? 'bg-[#04395a] text-white'
                        : 'text-gray-600 hover:bg-gray-100',
                    ]"
                  >
                    {{ p }}
                  </button>
                  <span
                    v-else-if="
                      (p === 2 && listPage > 3) ||
                      (p === listTotalPages - 1 && listPage < listTotalPages - 2)
                    "
                    class="w-8 h-8 flex items-center justify-center text-gray-300 text-xs"
                    >…</span
                  >
                </template>

                <button
                  type="button"
                  :disabled="listPage === listTotalPages"
                  @click="goToPage(listPage + 1)"
                  class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="2"
                    stroke="currentColor"
                    class="w-4 h-4"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="m8.25 4.5 7.5 7.5-7.5 7.5"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </template>
        </div>

        <!-- ════════════════════════════════════════════════════════════════
             TAB: BUSCAR
        ════════════════════════════════════════════════════════════════ -->
        <div v-show="activeTab === 'search'" class="mt-4 space-y-4">
          <!-- Single search input -->
          <div class="relative max-w-lg">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Buscar por DNI o nombre…"
              class="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition-colors"
            />
            <svg
              v-if="!searchLoading"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="#9ca3af"
              class="w-4 h-4 absolute left-3 top-3"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
              />
            </svg>
            <svg
              v-else
              class="w-4 h-4 absolute left-3 top-3 animate-spin text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </div>
          <p class="text-xs text-gray-400 -mt-2">
            DNI busca coincidencia exacta (mínimo 4 dígitos) · Nombre busca parcial (mínimo 2
            caracteres). Busca en Estudiantes, Docentes y Libre.
          </p>

          <!-- Search error -->
          <div
            v-if="searchError"
            class="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700"
          >
            {{ searchError }}
          </div>

          <!-- Results -->
          <div v-else-if="searchDone" class="space-y-4">
            <!-- ── Sin resultados ─────────────────────────────────────── -->
            <div
              v-if="!hasAnySearchResults"
              class="flex flex-col items-center justify-center py-10 text-center gap-4"
            >
              <div class="flex flex-col items-center gap-2">
                <div class="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="#ef4444"
                    class="w-6 h-6"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
                    />
                  </svg>
                </div>
                <p class="text-sm font-semibold text-gray-700">No se encontró ningún registro</p>
                <p class="text-xs text-gray-400">
                  No hay coincidencias en estudiantes, docentes ni libre.
                </p>
              </div>

              <!-- Botón crear -->
              <button
                v-if="!showCreateTypeSelector"
                type="button"
                @click="showCreateTypeSelector = true"
                class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#04395a] text-white text-sm font-medium hover:bg-[#068ab8] transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="2"
                  stroke="currentColor"
                  class="w-4 h-4"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Crear nuevo registro
              </button>

              <!-- Selector de tipo -->
              <div v-else class="flex flex-col items-center gap-3">
                <p class="text-xs font-medium text-gray-500">
                  ¿Qué tipo de registro quieres crear?
                </p>
                <div class="flex flex-wrap justify-center gap-2">
                  <button
                    v-for="opt in [
                      {
                        key: 'students',
                        label: 'Estudiante',
                        icon: 'M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z',
                      },
                      {
                        key: 'teachers',
                        label: 'Docente',
                        icon: 'M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.627 48.627 0 0 1 12 20.904a48.627 48.627 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 3.741-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5',
                      },
                      {
                        key: 'libre',
                        label: 'Libre',
                        icon: 'M15.182 15.182a4.5 4.5 0 0 1-6.364 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z',
                      },
                    ] as const"
                    :key="opt.key"
                    type="button"
                    @click="goToNewWithQuery(opt.key)"
                    class="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm font-medium text-gray-700 hover:border-[#04395a] hover:text-[#04395a] hover:bg-[#04395a]/4 transition-colors shadow-sm"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke-width="1.8"
                      stroke="currentColor"
                      class="w-4 h-4"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" :d="opt.icon" />
                    </svg>
                    {{ opt.label }}
                  </button>
                </div>
                <button
                  type="button"
                  @click="showCreateTypeSelector = false"
                  class="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
                >
                  Cancelar
                </button>
              </div>
            </div>

            <!-- ── Con resultados ─────────────────────────────────────── -->
            <template v-else>
              <!-- Banner total -->
              <div
                class="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-50 border border-green-200"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="2"
                  stroke="#16a34a"
                  class="w-5 h-5 shrink-0"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                  />
                </svg>
                <p class="text-sm font-medium text-green-800">
                  {{
                    searchResults.length + teacherSearchResults.length + libreSearchResults.length
                  }}
                  resultado{{
                    searchResults.length +
                      teacherSearchResults.length +
                      libreSearchResults.length !==
                    1
                      ? 's'
                      : ''
                  }}
                  encontrado{{
                    searchResults.length +
                      teacherSearchResults.length +
                      libreSearchResults.length !==
                    1
                      ? 's'
                      : ''
                  }}
                  <span class="font-normal text-green-700 ml-1"
                    >·
                    <span v-if="searchResults.length"
                      >{{ searchResults.length }} estudiante{{
                        searchResults.length !== 1 ? 's' : ''
                      }}</span
                    ><span
                      v-if="
                        searchResults.length &&
                        (teacherSearchResults.length || libreSearchResults.length)
                      "
                      >, </span
                    ><span v-if="teacherSearchResults.length"
                      >{{ teacherSearchResults.length }} docente{{
                        teacherSearchResults.length !== 1 ? 's' : ''
                      }}</span
                    ><span v-if="teacherSearchResults.length && libreSearchResults.length">, </span
                    ><span v-if="libreSearchResults.length"
                      >{{ libreSearchResults.length }} libre{{
                        libreSearchResults.length !== 1 ? 's' : ''
                      }}</span
                    >
                  </span>
                </p>
              </div>

              <!-- Grupo: Estudiantes -->
              <div v-if="searchResults.length > 0" class="space-y-2">
                <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">
                  Estudiantes
                </p>
                <div
                  v-for="student in searchResults"
                  :key="student.id"
                  class="bg-gray-50 hover:bg-[#04395a]/3 rounded-xl transition-colors duration-150"
                >
                  <div class="hidden sm:flex items-center gap-4 px-4 py-3.5">
                    <div
                      class="w-9 h-9 rounded-full bg-[#04395a]/10 flex items-center justify-center shrink-0 text-xs font-bold text-[#04395a]"
                    >
                      {{ student.full_name.charAt(0) }}
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-semibold text-gray-800">{{ student.full_name }}</p>
                      <p class="text-xs text-gray-400 mt-0.5 font-mono">
                        {{ student.dni
                        }}<span v-if="student.program" class="font-sans not-italic">
                          · {{ student.program }}</span
                        >
                      </p>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        @click="openDetail(student)"
                        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#04395a] bg-[#04395a]/8 hover:bg-[#04395a]/15 transition-colors"
                      >
                        Ver detalle
                      </button>
                      <RouterLink
                        v-if="candidateMap[student.id]"
                        :to="`/candidates/${candidateMap[student.id]}`"
                        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#068ab8] bg-blue-50 hover:bg-blue-100 transition-colors"
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
                            d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125"
                          />
                        </svg>
                        Editar Ficha
                      </RouterLink>
                      <button
                        v-else
                        type="button"
                        :disabled="creatingId === student.id"
                        @click="handleCreateCandidate(student)"
                        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-[#04395a] hover:bg-[#068ab8] transition-colors disabled:opacity-50"
                      >
                        <svg
                          v-if="creatingId !== student.id"
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
                            d="M12 4.5v15m7.5-7.5h-15"
                          />
                        </svg>
                        <svg
                          v-else
                          class="w-3.5 h-3.5 animate-spin"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            class="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            stroke-width="4"
                          />
                          <path
                            class="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                          />
                        </svg>
                        Crear Ficha
                      </button>
                    </div>
                  </div>
                  <div class="sm:hidden p-4 space-y-3">
                    <div class="flex items-center gap-3">
                      <div
                        class="w-9 h-9 rounded-full bg-[#04395a]/10 flex items-center justify-center shrink-0 text-xs font-bold text-[#04395a]"
                      >
                        {{ student.full_name.charAt(0) }}
                      </div>
                      <div>
                        <p class="text-sm font-semibold text-gray-800">{{ student.full_name }}</p>
                        <p class="text-xs font-mono text-gray-400">{{ student.dni }}</p>
                      </div>
                    </div>
                    <div class="flex gap-2">
                      <button
                        type="button"
                        @click="openDetail(student)"
                        class="flex-1 py-2 rounded-xl text-xs font-medium text-[#04395a] bg-[#04395a]/8 hover:bg-[#04395a]/15 transition-colors"
                      >
                        Ver detalle
                      </button>
                      <RouterLink
                        v-if="candidateMap[student.id]"
                        :to="`/candidates/${candidateMap[student.id]}`"
                        class="flex-1 py-2 rounded-xl text-xs font-medium text-center text-[#068ab8] bg-blue-50 hover:bg-blue-100 transition-colors"
                        >Editar Ficha</RouterLink
                      >
                      <button
                        v-else
                        type="button"
                        :disabled="creatingId === student.id"
                        @click="handleCreateCandidate(student)"
                        class="flex-1 py-2 rounded-xl text-xs font-medium text-white bg-[#04395a] hover:bg-[#068ab8] transition-colors disabled:opacity-50"
                      >
                        Crear Ficha
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Grupo: Docentes -->
              <div v-if="teacherSearchResults.length > 0" class="space-y-2">
                <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">
                  Docentes
                </p>
                <div
                  v-for="teacher in teacherSearchResults"
                  :key="teacher.id"
                  class="bg-gray-50 hover:bg-[#04395a]/3 rounded-xl transition-colors duration-150"
                >
                  <div class="hidden sm:flex items-center gap-4 px-4 py-3.5">
                    <div
                      class="w-9 h-9 rounded-full bg-[#04395a]/10 flex items-center justify-center shrink-0 text-xs font-bold text-[#04395a]"
                    >
                      {{ teacher.full_name.charAt(0) }}
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-semibold text-gray-800">{{ teacher.full_name }}</p>
                      <p class="text-xs text-gray-400 mt-0.5 font-mono">
                        {{ teacher.dni
                        }}<span v-if="teacher.main_ep" class="font-sans not-italic">
                          · {{ teacher.main_ep }}</span
                        >
                      </p>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                      <RouterLink
                        v-if="teacherCandidateMap[teacher.id]"
                        :to="`/candidates/${teacherCandidateMap[teacher.id]}`"
                        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#068ab8] bg-blue-50 hover:bg-blue-100 transition-colors"
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
                            d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125"
                          />
                        </svg>
                        Editar Ficha
                      </RouterLink>
                      <button
                        v-else
                        type="button"
                        :disabled="creatingId === teacher.id"
                        @click="handleCreateTeacherCandidate(teacher)"
                        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-[#04395a] hover:bg-[#068ab8] transition-colors disabled:opacity-50"
                      >
                        <svg
                          v-if="creatingId !== teacher.id"
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
                            d="M12 4.5v15m7.5-7.5h-15"
                          />
                        </svg>
                        <svg
                          v-else
                          class="w-3.5 h-3.5 animate-spin"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            class="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            stroke-width="4"
                          />
                          <path
                            class="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                          />
                        </svg>
                        Crear Ficha
                      </button>
                    </div>
                  </div>
                  <div class="sm:hidden p-4 space-y-3">
                    <div>
                      <p class="text-sm font-semibold text-gray-800">{{ teacher.full_name }}</p>
                      <p class="text-xs font-mono text-gray-400">{{ teacher.dni }}</p>
                    </div>
                    <div class="flex gap-2">
                      <RouterLink
                        v-if="teacherCandidateMap[teacher.id]"
                        :to="`/candidates/${teacherCandidateMap[teacher.id]}`"
                        class="flex-1 py-2 rounded-xl text-xs font-medium text-center text-[#068ab8] bg-blue-50 hover:bg-blue-100 transition-colors"
                        >Editar Ficha</RouterLink
                      >
                      <button
                        v-else
                        type="button"
                        :disabled="creatingId === teacher.id"
                        @click="handleCreateTeacherCandidate(teacher)"
                        class="flex-1 py-2 rounded-xl text-xs font-medium text-white bg-[#04395a] hover:bg-[#068ab8] transition-colors disabled:opacity-50"
                      >
                        Crear Ficha
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Grupo: Libre -->
              <div v-if="libreSearchResults.length > 0" class="space-y-2">
                <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">
                  Libre
                </p>
                <div
                  v-for="person in libreSearchResults"
                  :key="person.id"
                  class="bg-gray-50 hover:bg-[#04395a]/3 rounded-xl transition-colors duration-150"
                >
                  <div class="hidden sm:flex items-center gap-4 px-4 py-3.5">
                    <div
                      class="w-9 h-9 rounded-full bg-[#04395a]/10 flex items-center justify-center shrink-0 text-xs font-bold text-[#04395a]"
                    >
                      {{ person.full_name.charAt(0) }}
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-semibold text-gray-800">{{ person.full_name }}</p>
                      <p class="text-xs text-gray-400 mt-0.5 font-mono">
                        {{ person.dni
                        }}<span v-if="person.phone" class="font-sans not-italic">
                          · {{ person.phone }}</span
                        >
                      </p>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                      <RouterLink
                        v-if="candidateMap[person.id]"
                        :to="`/candidates/${candidateMap[person.id]}`"
                        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#068ab8] bg-blue-50 hover:bg-blue-100 transition-colors"
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
                            d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125"
                          />
                        </svg>
                        Editar Ficha
                      </RouterLink>
                      <button
                        v-else
                        type="button"
                        :disabled="creatingId === person.id"
                        @click="handleCreateCandidate(person)"
                        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-[#04395a] hover:bg-[#068ab8] transition-colors disabled:opacity-50"
                      >
                        <svg
                          v-if="creatingId !== person.id"
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
                            d="M12 4.5v15m7.5-7.5h-15"
                          />
                        </svg>
                        <svg
                          v-else
                          class="w-3.5 h-3.5 animate-spin"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            class="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            stroke-width="4"
                          />
                          <path
                            class="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                          />
                        </svg>
                        Crear Ficha
                      </button>
                    </div>
                  </div>
                  <div class="sm:hidden p-4 space-y-3">
                    <div>
                      <p class="text-sm font-semibold text-gray-800">{{ person.full_name }}</p>
                      <p class="text-xs font-mono text-gray-400">{{ person.dni }}</p>
                    </div>
                    <div class="flex gap-2">
                      <RouterLink
                        v-if="candidateMap[person.id]"
                        :to="`/candidates/${candidateMap[person.id]}`"
                        class="flex-1 py-2 rounded-xl text-xs font-medium text-center text-[#068ab8] bg-blue-50 hover:bg-blue-100 transition-colors"
                        >Editar Ficha</RouterLink
                      >
                      <button
                        v-else
                        type="button"
                        :disabled="creatingId === person.id"
                        @click="handleCreateCandidate(person)"
                        class="flex-1 py-2 rounded-xl text-xs font-medium text-white bg-[#04395a] hover:bg-[#068ab8] transition-colors disabled:opacity-50"
                      >
                        Crear Ficha
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <!-- Estado inicial -->
          <div v-else class="flex flex-col items-center justify-center py-12 text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.2"
              stroke="#d1d5db"
              class="w-10 h-10 mb-2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
              />
            </svg>
            <p class="text-sm text-gray-400">
              Escribe un DNI o nombre para buscar en todos los registros.
            </p>
          </div>
        </div>

        <!-- ══════════════════════════════════════════════════════════════════
             TAB 3 — NUEVO
        ══════════════════════════════════════════════════════════════════ -->
        <div v-show="activeTab === 'new'" class="mt-4 space-y-4">
          <!-- Selector de fuente -->
          <div class="flex items-center gap-2">
            <button
              v-for="src in [
                { key: 'students', label: 'Estudiante' },
                { key: 'teachers', label: 'Docente' },
                { key: 'libre', label: 'Libre' },
              ] as const"
              :key="src.key"
              type="button"
              @click="newSource = src.key"
              :class="[
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                newSource === src.key
                  ? 'bg-[#04395a] text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
              ]"
            >
              {{ src.label }}
            </button>
          </div>

          <!-- ── ESTUDIANTES ─────────────────────────────────────── -->
          <div v-if="newSource === 'students'" class="max-w-lg space-y-3">
            <div class="border border-gray-200 rounded-2xl p-4 space-y-3 bg-gray-50/60">
              <div class="flex items-center justify-between">
                <p class="text-xs font-semibold text-[#04395a] uppercase tracking-wide">
                  Nuevo estudiante
                </p>
                <button
                  type="button"
                  @click="resetStudentForm"
                  class="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
                >
                  Limpiar
                </button>
              </div>

              <!-- Nombre + DNI -->
              <div class="grid grid-cols-2 gap-3">
                <div class="col-span-2">
                  <label class="block text-xs font-medium text-gray-500 mb-1"
                    >Nombre completo <span class="text-red-400">*</span></label
                  >
                  <input
                    v-model="nsFullName"
                    type="text"
                    placeholder="Nombres y apellidos…"
                    class="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition bg-white"
                  />
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-500 mb-1"
                    >DNI <span class="text-red-400">*</span></label
                  >
                  <input
                    v-model="nsDocId"
                    type="text"
                    placeholder="Ej: 12345678"
                    class="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition bg-white"
                  />
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-500 mb-1">Sexo</label>
                  <select
                    v-model="nsSex"
                    class="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition bg-white"
                  >
                    <option value="">Sin especificar</option>
                    <option value="1">Masculino</option>
                    <option value="2">Femenino</option>
                  </select>
                </div>
              </div>

              <!-- F. nacimiento + Teléfono + Correo -->
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-medium text-gray-500 mb-1"
                    >Fecha de nacimiento</label
                  >
                  <input
                    v-model="nsBirthDate"
                    type="date"
                    class="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition bg-white"
                  />
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-500 mb-1">Teléfono</label>
                  <input
                    v-model="nsPhone"
                    type="tel"
                    placeholder="Ej: 999 999 999"
                    class="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition bg-white"
                  />
                </div>
                <div class="col-span-2">
                  <label class="block text-xs font-medium text-gray-500 mb-1"
                    >Correo electrónico</label
                  >
                  <input
                    v-model="nsEmail"
                    type="email"
                    placeholder="correo@ejemplo.com"
                    class="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition bg-white"
                  />
                </div>
              </div>

              <!-- Campus → Facultad → Programa → Ciclo (en cascada) -->
              <div v-if="catalogLoading" class="flex items-center gap-2 py-2 text-xs text-gray-400">
                <svg class="w-3.5 h-3.5 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                  />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Cargando catálogo de sedes…
              </div>
              <div class="grid grid-cols-2 gap-3">
                <!-- Campus -->
                <div class="col-span-2">
                  <label class="block text-xs font-medium text-gray-500 mb-1">Campus / Sede</label>
                  <select
                    v-model="nsCampus"
                    :disabled="catalogLoading"
                    class="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition bg-white disabled:opacity-50"
                  >
                    <option value="">— Selecciona sede —</option>
                    <option v-for="c in campusOptions" :key="c" :value="c">{{ c }}</option>
                  </select>
                </div>
                <!-- Facultad (depende de Campus) -->
                <div class="col-span-2">
                  <label class="block text-xs font-medium text-gray-500 mb-1">Facultad</label>
                  <select
                    v-model="nsFaculty"
                    :disabled="!nsCampus || catalogLoading"
                    class="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition bg-white disabled:opacity-50"
                  >
                    <option value="">— Selecciona facultad —</option>
                    <option v-for="f in facultyOptions" :key="f" :value="f">{{ f }}</option>
                  </select>
                </div>
                <!-- Programa (depende de Facultad) -->
                <div class="col-span-2">
                  <label class="block text-xs font-medium text-gray-500 mb-1"
                    >Programa de estudio</label
                  >
                  <select
                    v-model="nsProgram"
                    :disabled="!nsFaculty || catalogLoading"
                    class="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition bg-white disabled:opacity-50"
                  >
                    <option value="">— Selecciona programa —</option>
                    <option v-for="p in programOptions" :key="p" :value="p">{{ p }}</option>
                  </select>
                </div>
                <!-- Ciclo -->
                <div>
                  <label class="block text-xs font-medium text-gray-500 mb-1">Ciclo</label>
                  <input
                    v-model="nsCycle"
                    type="text"
                    placeholder="Ej: VII"
                    class="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition bg-white"
                  />
                </div>
              </div>

              <p v-if="nsError" class="text-xs text-red-600 font-medium">{{ nsError }}</p>

              <button
                type="button"
                :disabled="!nsValid || nsSaving"
                @click="handleCreateStudent"
                class="w-full py-2.5 rounded-xl text-sm font-medium text-white bg-[#04395a] hover:bg-[#068ab8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {{ nsSaving ? 'Creando…' : 'Crear estudiante y abrir ficha' }}
              </button>
            </div>
          </div>

          <!-- ── DOCENTES ────────────────────────────────────────── -->
          <div v-else-if="newSource === 'teachers'" class="max-w-lg space-y-3">
            <div class="border border-gray-200 rounded-2xl p-4 space-y-3 bg-gray-50/60">
              <div class="flex items-center justify-between">
                <p class="text-xs font-semibold text-[#04395a] uppercase tracking-wide">
                  Nuevo docente
                </p>
                <button
                  type="button"
                  @click="resetTeacherForm"
                  class="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
                >
                  Limpiar
                </button>
              </div>

              <!-- Nombre + DNI -->
              <div class="grid grid-cols-2 gap-3">
                <div class="col-span-2">
                  <label class="block text-xs font-medium text-gray-500 mb-1"
                    >Nombre completo <span class="text-red-400">*</span></label
                  >
                  <input
                    v-model="ntFullName"
                    type="text"
                    placeholder="Nombres y apellidos…"
                    class="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition bg-white"
                  />
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-500 mb-1"
                    >DNI <span class="text-red-400">*</span></label
                  >
                  <input
                    v-model="ntDni"
                    type="text"
                    placeholder="Ej: 12345678"
                    class="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition bg-white"
                  />
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-500 mb-1"
                    >Tipo de documento</label
                  >
                  <input
                    v-model="ntDocType"
                    type="text"
                    placeholder="Ej: DNI, CE…"
                    class="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition bg-white"
                  />
                </div>
              </div>

              <!-- Grado + Régimen -->
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-medium text-gray-500 mb-1"
                    >Grado académico</label
                  >
                  <input
                    v-model="ntAcademicDegree"
                    type="text"
                    placeholder="Ej: Magíster, Doctor…"
                    class="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition bg-white"
                  />
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-500 mb-1"
                    >Régimen de dedicación</label
                  >
                  <input
                    v-model="ntDedicationRegime"
                    type="text"
                    placeholder="Ej: TC, TP…"
                    class="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition bg-white"
                  />
                </div>
              </div>

              <!-- Condición laboral + Condición -->
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-medium text-gray-500 mb-1"
                    >Condición laboral</label
                  >
                  <input
                    v-model="ntLaborCondition"
                    type="text"
                    placeholder="Ej: Nombrado, Contratado…"
                    class="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition bg-white"
                  />
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-500 mb-1">Condición</label>
                  <input
                    v-model="ntCondition"
                    type="text"
                    placeholder="Ej: Activo, Cesante…"
                    class="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition bg-white"
                  />
                </div>
              </div>

              <!-- Facultad + EP Principal + Campus -->
              <div class="grid grid-cols-2 gap-3">
                <div class="col-span-2">
                  <label class="block text-xs font-medium text-gray-500 mb-1">Facultad</label>
                  <input
                    v-model="ntFaculty"
                    type="text"
                    placeholder="Facultad…"
                    class="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition bg-white"
                  />
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-500 mb-1">EP Principal</label>
                  <input
                    v-model="ntMainEp"
                    type="text"
                    placeholder="Escuela profesional…"
                    class="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition bg-white"
                  />
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-500 mb-1">Campus / Sede</label>
                  <input
                    v-model="ntCampus"
                    type="text"
                    placeholder="Campus…"
                    class="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition bg-white"
                  />
                </div>
              </div>

              <p v-if="ntError" class="text-xs text-red-600 font-medium">{{ ntError }}</p>

              <button
                type="button"
                :disabled="!ntValid || ntSaving"
                @click="handleCreateTeacher"
                class="w-full py-2.5 rounded-xl text-sm font-medium text-white bg-[#04395a] hover:bg-[#068ab8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {{ ntSaving ? 'Creando…' : 'Crear docente y abrir ficha' }}
              </button>
            </div>
          </div>

          <!-- ── LIBRE ───────────────────────────────────────────── -->
          <div v-else class="max-w-lg space-y-4">
            <div
              class="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="#d97706"
                class="w-4 h-4 shrink-0 mt-0.5"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                />
              </svg>
              <p class="text-xs text-amber-800">
                Persona que <strong>no está en el sistema</strong> como estudiante ni docente. Si el
                DNI ya existe, se usará el registro existente.
              </p>
            </div>

            <!-- Nombre completo -->
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1.5"
                >Nombre completo <span class="text-red-400">*</span></label
              >
              <input
                v-model="newFullName"
                type="text"
                placeholder="Nombres y apellidos…"
                class="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition"
              />
            </div>

            <!-- DNI -->
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1.5"
                >DNI / Documento de identidad <span class="text-red-400">*</span></label
              >
              <input
                v-model="newDni"
                type="text"
                placeholder="Ej: 12345678"
                class="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition"
              />
            </div>

            <!-- Sexo + Fecha de nacimiento -->
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-medium text-gray-500 mb-1.5">Sexo</label>
                <select
                  v-model="newSex"
                  class="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition bg-white"
                >
                  <option value="">Sin especificar</option>
                  <option value="1">Masculino</option>
                  <option value="2">Femenino</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-500 mb-1.5"
                  >Fecha de nacimiento</label
                >
                <input
                  v-model="newBirthDate"
                  type="date"
                  class="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition"
                />
              </div>
            </div>

            <!-- Teléfono + Correo -->
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-medium text-gray-500 mb-1.5">Teléfono</label>
                <input
                  v-model="newPhone"
                  type="tel"
                  placeholder="Ej: 999 999 999"
                  class="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-500 mb-1.5"
                  >Correo electrónico</label
                >
                <input
                  v-model="newEmail"
                  type="email"
                  placeholder="correo@ejemplo.com"
                  class="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition"
                />
              </div>
            </div>

            <p v-if="newError" class="text-xs text-red-600 font-medium">{{ newError }}</p>

            <button
              type="button"
              :disabled="!newFormValid || newSaving"
              @click="handleCreatePerson"
              class="w-full py-2.5 rounded-xl text-sm font-medium text-white bg-[#04395a] hover:bg-[#068ab8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {{ newSaving ? 'Creando ficha…' : 'Crear ficha' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ════════════════════════════════════════════════════════════════════════
       MODAL DETALLE
  ════════════════════════════════════════════════════════════════════════ -->
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @click.self="closeModal"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="closeModal" />

        <!-- Panel -->
        <div
          class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
        >
          <!-- Header -->
          <div
            class="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0"
          >
            <div>
              <h3 class="text-base font-bold text-[#04395a]">Detalle del Estudiante</h3>
              <p class="text-xs text-gray-400 mt-0.5" v-if="modalStudent">{{ modalStudent.dni }}</p>
            </div>
            <button
              type="button"
              @click="closeModal"
              class="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
                class="w-5 h-5"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="flex-1 overflow-y-auto px-6 py-5">
            <!-- Loading -->
            <div v-if="modalLoading" class="space-y-3">
              <div
                v-for="i in 8"
                :key="i"
                class="h-10 bg-gray-100 rounded-xl animate-pulse"
                :style="{ opacity: 1 - i * 0.08 }"
              />
            </div>

            <!-- Error -->
            <div
              v-else-if="modalError"
              class="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-4"
            >
              {{ modalError }}
            </div>

            <!-- Data -->
            <div v-else-if="modalStudent" class="space-y-1">
              <!-- Avatar + name -->
              <div class="flex items-center gap-4 pb-4 mb-4 border-b border-gray-100">
                <div
                  class="w-14 h-14 rounded-2xl bg-[#04395a]/10 flex items-center justify-center shrink-0 text-xl font-bold text-[#04395a]"
                >
                  {{ modalStudent.full_name.charAt(0) }}
                </div>
                <div>
                  <p class="text-base font-bold text-gray-800">{{ modalStudent.full_name }}</p>
                  <p class="text-sm font-mono text-gray-500 mt-0.5">{{ modalStudent.dni }}</p>
                </div>
              </div>

              <!-- Field grid -->
              <div class="grid grid-cols-2 gap-x-6 gap-y-3">
                <template
                  v-for="field in [
                    { label: 'Sexo', value: modalStudent.sex },
                    { label: 'Email institucional', value: modalStudent.institutional_email },
                    { label: 'Celular', value: modalStudent.phone },
                    { label: 'Programa', value: modalStudent.program },
                    { label: 'Facultad', value: modalStudent.faculty },
                    { label: 'Sede', value: modalStudent.campus },
                    { label: 'Modalidad', value: modalStudent.modality },
                    { label: 'Ciclo', value: modalStudent.cycle },
                    { label: 'Grupo', value: modalStudent.group },
                    { label: 'País', value: modalStudent.country },
                    { label: 'Fecha de nacimiento', value: formatDate(modalStudent.birth_date) },
                    { label: 'Código estudiante', value: modalStudent.student_code },
                  ]"
                  :key="field.label"
                >
                  <div
                    :class="[
                      'py-2.5 border-b border-gray-50',
                      field.label === 'Email institucional' ||
                      field.label === 'Programa' ||
                      field.label === 'Facultad'
                        ? 'col-span-2'
                        : '',
                    ]"
                  >
                    <p class="text-xs text-gray-400 mb-0.5">{{ field.label }}</p>
                    <p class="text-sm font-medium text-gray-700 truncate">
                      {{ field.value ?? '—' }}
                    </p>
                  </div>
                </template>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-6 py-4 border-t border-gray-100 flex justify-end gap-2 shrink-0">
            <button
              type="button"
              @click="closeModal"
              class="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cerrar
            </button>
            <template v-if="modalStudent">
              <!-- Ya tiene ficha → Editar -->
              <RouterLink
                v-if="candidateMap[modalStudent.id]"
                :to="`/candidates/${candidateMap[modalStudent.id]}`"
                @click="closeModal"
                class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-[#068ab8] bg-blue-50 hover:bg-blue-100 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="2"
                  stroke="currentColor"
                  class="w-4 h-4"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125"
                  />
                </svg>
                Editar Ficha
              </RouterLink>
              <!-- Sin ficha → Crear -->
              <button
                v-else
                type="button"
                :disabled="creatingId === modalStudent.id"
                @click="
                  () => {
                    if (modalStudent) {
                      handleCreateCandidate(modalStudent)
                      closeModal()
                    }
                  }
                "
                class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[#04395a] hover:bg-[#068ab8] transition-colors disabled:opacity-50"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="2"
                  stroke="currentColor"
                  class="w-4 h-4"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Crear Ficha
              </button>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-active .relative,
.modal-leave-active .relative {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .relative,
.modal-leave-to .relative {
  opacity: 0;
  transform: scale(0.96) translateY(8px);
}
</style>
