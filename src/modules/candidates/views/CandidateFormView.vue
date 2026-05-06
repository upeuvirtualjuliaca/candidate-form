<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePermissions } from '@/composables/usePermissions'
import Tabs, { type Tab } from '@/components/ui/Tabs.vue'
import {
  getCandidateDetail,
  saveCandidateForm,
  deleteCandidate,
  type CandidateDetail,
  type CandidateFormPayload,
  type CandidateStatus,
} from '@/modules/candidates/services/candidates.service'
import {
  FAITH_QUESTIONS,
  HOW_KNEW_IASD_OPTIONS,
  HOW_STUDIED_BIBLE_OPTIONS,
  DECISIVE_FACTOR_OPTIONS,
} from '@/modules/candidates/constants/faithForm'
import { generateCandidatePdf, previewCandidatePdf } from '@/modules/candidates/utils/candidatePdf'
import { searchStudents, type Student } from '@/modules/students/services/students.service'
import { searchPastors, type Pastor } from '@/modules/pastors/services/pastors.service'
import FieldStatus from '@/modules/candidates/components/FieldStatus.vue'
import SignaturePad from '@/components/ui/SignaturePad.vue'
import { getPrincipalActiveSecretary } from '@/modules/secretaries/services/secretaries.service'

const route = useRoute()
const router = useRouter()
const id = computed(() => route.params['id'] as string)
const { canWrite } = usePermissions()

// ── Tabs ───────────────────────────────────────────────────────────────────

const tabs: Tab[] = [
  { key: 'identificacion', label: 'Identificación' },
  { key: 'conversion', label: 'Conversión' },
  { key: 'fe', label: 'Declaración de fe' },
  { key: 'ceremonia', label: 'Ceremonia' },
]
const activeTab = ref('identificacion')

// ── State ──────────────────────────────────────────────────────────────────

const loading = ref(true)
const loadError = ref<string | null>(null)
const saving = ref(false)
const deleting = ref(false)
const generatingPdf = ref(false)
const showDeleteConfirm = ref(false)
const showPreview = ref(false)
const pdfPreviewUrl = ref<string | null>(null)
const loadingPreview = ref(false)
const saveMsg = ref('')
const saveMsgError = ref(false)
const showSavedToast = ref(false)
let savedToastTimer: ReturnType<typeof setTimeout> | null = null

function triggerSavedToast() {
  if (savedToastTimer) clearTimeout(savedToastTimer)
  showSavedToast.value = true
  savedToastTimer = setTimeout(() => { showSavedToast.value = false }, 3500)
}

const candidate = ref<CandidateDetail | null>(null)

// ── Form fields ────────────────────────────────────────────────────────────

// Identificación
const observations = ref('')
const ceremonyType = ref<'baptism' | 'rebaptism' | 'faith_profession'>('baptism')
const address = ref('')
const educationLevel = ref<'none' | 'primary' | 'secondary' | 'higher' | 'other' | null>(null)
const educationLevelOther = ref('')
const maritalStatus = ref<'single' | 'divorced' | 'widowed' | 'married' | 'other'>('single')
const weddingDate = ref('')
const hasDisability = ref(false)
const disabilityTypes = ref<string[]>([])
const guardian1Name = ref('')
const guardian1Document = ref('')
const guardian2Name = ref('')
const guardian2Document = ref('')
const showGuardian2 = ref(false)

// Normaliza datos personales desde students o teachers
const person = computed(() => {
  const c = candidate.value
  if (!c) return null
  if (c.students) return c.students
  if (c.teachers)
    return {
      id: c.teachers.id,
      dni: c.teachers.dni,
      full_name: c.teachers.full_name,
      sex: c.teachers.sex,
      institutional_email: c.teachers.email,
      phone: c.teachers.phone,
      program: c.teachers.main_ep,
      faculty: c.teachers.faculty,
      campus: c.teachers.campus,
      modality: c.teachers.dedication_regime,
      cycle: c.teachers.condition,
      group: c.teachers.academic_degree,
      country: c.teachers.country,
      postal_code: null as string | null,
      birth_date: c.teachers.birth_date,
      religion: null as string | null,
    }
  return null
})

const isMinor = computed(() => {
  const birth = person.value?.birth_date
  if (!birth) return false
  const today = new Date()
  const dob = new Date(birth)
  const age =
    today.getFullYear() -
    dob.getFullYear() -
    (today < new Date(today.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0)
  return age < 18
})

// Conversión
const RELIGION_OPTIONS = [
  'Católico',
  'Evangélico',
  'Protestante',
  'Testigos de Jehová',
  'Mormón (SUD)',
  'Ninguna',
  'Otra',
]

const biblicalInstructor1 = ref('')
const biblicalInstructor2 = ref('')
const showInstructor2 = ref(false)
const previousReligion = ref('')
const previousReligionOther = ref('')
const howKnewIasd = ref('Educación Adventista')
const howStudiedBible = ref('Clase Bíblica Educación')
const decisiveFactor = ref('Educación Adventista')

// Declaración de fe
const faithAnswers = ref<Record<string, boolean | null>>(
  Object.fromEntries(Array.from({ length: 13 }, (_, i) => [String(i), true])),
)
const consentAccepted = ref(true)
const signatureData = ref<string | null>(null)
const signatureSaved = ref(false)

// Ceremonia
const todayStr = new Date().toISOString().slice(0, 10)
const ceremonyDate = ref(todayStr)
const ceremonyPlace = ref('Fernando Stahl')
const officatingPastor = ref('')
const officatingPastorDni = ref('')
const receivingChurch = ref('Fernando Stahl')
const churchCity = ref('Juliaca - San Román')
const administrativeMeetingDate = ref(new Date().toISOString().slice(0, 10))
const ceremonyNotes = ref('')
const churchSecretary = ref('')

async function loadPrincipalSecretary() {
  try {
    const sec = await getPrincipalActiveSecretary()
    churchSecretary.value = sec?.full_name ?? ''
  } catch {
    // no bloquea el formulario si falla
  }
}

// Pastor autocomplete
const pastorQuery = ref('')
const pastorSuggestions = ref<Pastor[]>([])
const showPastorDrop = ref(false)
const selectedPastor = ref<Pastor | null>(null)
let pastorDebounce: ReturnType<typeof setTimeout> | null = null

async function onPastorInput() {
  if (selectedPastor.value) return // locked — must clear first
  if (pastorDebounce) clearTimeout(pastorDebounce)
  const q = pastorQuery.value.trim()
  if (q.length < 2) {
    pastorSuggestions.value = []
    showPastorDrop.value = false
    return
  }
  pastorDebounce = setTimeout(async () => {
    const isNum = /^\d+$/.test(q)
    const results = await searchPastors(isNum ? { dni: q } : { name: q })
    pastorSuggestions.value = results.slice(0, 8)
    showPastorDrop.value = results.length > 0
  }, 250)
}

function selectPastor(p: Pastor) {
  selectedPastor.value = p
  officatingPastor.value = p.full_name
  officatingPastorDni.value = p.dni
  pastorQuery.value = p.full_name
  showPastorDrop.value = false
  pastorSuggestions.value = []
}

function clearPastorSelection() {
  selectedPastor.value = null
  officatingPastor.value = ''
  officatingPastorDni.value = ''
  pastorQuery.value = ''
  pastorSuggestions.value = []
}

function removeGuardian2() {
  showGuardian2.value = false
  guardian2Name.value = ''
  guardian2Document.value = ''
}

function removeInstructor2() {
  showInstructor2.value = false
  biblicalInstructor2.value = ''
}

function closePastorDropDelayed() {
  setTimeout(() => {
    showPastorDrop.value = false
  }, 150)
}

function openPastorDropIfHasSuggestions() {
  if (!selectedPastor.value && pastorSuggestions.value.length) showPastorDrop.value = true
}

// ── Progress ───────────────────────────────────────────────────────────────

const identificationDone = ref(false)
const conversionDone = ref(false)
const faithDone = ref(false)
const ceremonyDone = ref(false)
const showFaithQuestions = ref(false)
const showHowKnewIasd = ref(false)
const showHowStudiedBible = ref(false)
const showDecisiveFactor = ref(false)
const status = ref<CandidateStatus>('draft')

const progressPct = computed(() => {
  const done = [
    identificationDone.value,
    conversionDone.value,
    faithDone.value,
    ceremonyDone.value,
  ].filter(Boolean).length
  return Math.round((done / 4) * 100)
})

// ── Load ───────────────────────────────────────────────────────────────────

async function loadDetail() {
  loading.value = true
  loadError.value = null
  try {
    const data = await getCandidateDetail(id.value)
    candidate.value = data

    // Identificación
    observations.value = data.observations ?? ''
    ceremonyType.value = data.ceremony_type ?? 'baptism'
    address.value = data.address ?? ''
    educationLevel.value = data.education_level ?? null
    educationLevelOther.value = data.education_level_other ?? ''
    maritalStatus.value = data.marital_status ?? 'single'
    weddingDate.value = data.wedding_date?.slice(0, 10) ?? ''
    hasDisability.value = data.has_disability ?? false
    disabilityTypes.value = Array.isArray(data.disability_types) ? data.disability_types : []
    guardian1Name.value = data.guardian_1_name ?? ''
    guardian1Document.value = data.guardian_1_document ?? ''
    guardian2Name.value = data.guardian_2_name ?? ''
    guardian2Document.value = data.guardian_2_document ?? ''
    showGuardian2.value = !!data.guardian_2_name

    // Conversión
    biblicalInstructor1.value = data.biblical_instructor_1 ?? ''
    biblicalInstructor2.value = data.biblical_instructor_2 ?? ''
    showInstructor2.value = !!data.biblical_instructor_2
    const savedReligion =
      data.previous_religion ?? data.students?.religion ?? data.teachers?.condition ?? ''
    if (savedReligion && !RELIGION_OPTIONS.slice(0, -1).includes(savedReligion)) {
      previousReligion.value = 'Otra'
      previousReligionOther.value = savedReligion
    } else {
      previousReligion.value = savedReligion
    }
    howKnewIasd.value = data.how_knew_iasd ?? 'Educación Adventista'
    howStudiedBible.value = data.how_studied_bible ?? 'Clase Bíblica Educación'
    decisiveFactor.value = data.decisive_factor ?? 'Educación Adventista'

    // Ceremonia
    ceremonyDate.value = data.ceremony_date?.slice(0, 10) ?? todayStr
    ceremonyPlace.value = data.ceremony_place ?? 'Aud. Fernando Stahl'
    officatingPastor.value = data.officiating_pastor ?? ''
    officatingPastorDni.value = data.officiating_pastor_dni ?? ''
    receivingChurch.value = data.receiving_church ?? 'Villa Chullunquiani - UPeU'
    churchCity.value = data.church_city ?? 'Juliaca - San Román (Puno)'
    administrativeMeetingDate.value =
      data.administrative_meeting_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)
    ceremonyNotes.value = data.ceremony_notes ?? ''
    if (data.officiating_pastor) {
      pastorQuery.value = data.officiating_pastor
      if (data.officiating_pastor_dni) {
        // Lock the DNI as read-only (pastor was previously selected from the catalogue)
        selectedPastor.value = {
          id: '',
          dni: data.officiating_pastor_dni,
          full_name: data.officiating_pastor,
          phone: null,
          created_at: '',
          programs: [],
        }
      }
    }

    // Fe
    if (
      data.faith_completed &&
      data.faith_answers &&
      typeof data.faith_answers === 'object' &&
      Object.keys(data.faith_answers).length > 0
    ) {
      faithAnswers.value = data.faith_answers as Record<string, boolean | null>
    }
    consentAccepted.value = data.faith_completed ? (data.consent_accepted ?? true) : true
    signatureData.value = data.signature_data ?? null
    if (signatureData.value) signatureSaved.value = true

    // Progress
    identificationDone.value = data.identification_completed
    conversionDone.value = data.conversion_completed
    faithDone.value = data.faith_completed
    // Computed from form fields — ceremony_completed in DB is owned by validation view
    ceremonyDone.value = !!(data.officiating_pastor?.trim() && data.ceremony_date)
    status.value = data.status

    // Snapshot inicial (datos ya guardados en DB)
    savedSnap.value = buildSnap()
  } catch (err: unknown) {
    loadError.value = err instanceof Error ? err.message : 'Error al cargar la ficha.'
  } finally {
    loading.value = false
  }
}

watch(id, () => {
  loadDetail()
  loadPrincipalSecretary()
}, { immediate: true })

// ── Save ───────────────────────────────────────────────────────────────────

async function save() {
  saving.value = true
  saveMsg.value = ''
  saveMsgError.value = false
  try {
    const payload: CandidateFormPayload = {
      // Identificación
      observations: observations.value || null,
      ceremony_type: ceremonyType.value,
      address: address.value || null,
      education_level: educationLevel.value,
      education_level_other:
        educationLevel.value === 'other' ? educationLevelOther.value || null : null,
      marital_status: maritalStatus.value,
      wedding_date: maritalStatus.value === 'married' ? weddingDate.value || null : null,
      has_disability: hasDisability.value,
      disability_types: hasDisability.value ? [...disabilityTypes.value] : [],
      guardian_1_name: isMinor.value ? guardian1Name.value || null : null,
      guardian_1_document: isMinor.value ? guardian1Document.value || null : null,
      guardian_2_name: isMinor.value && showGuardian2.value ? guardian2Name.value || null : null,
      guardian_2_document:
        isMinor.value && showGuardian2.value ? guardian2Document.value || null : null,
      // Conversión
      biblical_instructor_1: biblicalInstructor1.value || null,
      biblical_instructor_2: biblicalInstructor2.value || null,
      previous_religion:
        previousReligion.value === 'Otra'
          ? previousReligionOther.value || null
          : previousReligion.value || null,
      how_knew_iasd: howKnewIasd.value || null,
      how_studied_bible: howStudiedBible.value || null,
      decisive_factor: decisiveFactor.value || null,
      // Ceremonia
      ceremony_date: ceremonyDate.value || null,
      ceremony_place: ceremonyPlace.value || null,
      officiating_pastor: officatingPastor.value || null,
      officiating_pastor_dni: officatingPastorDni.value || null,
      receiving_church: receivingChurch.value || null,
      church_city: churchCity.value || null,
      administrative_meeting_date: administrativeMeetingDate.value || null,
      ceremony_notes: ceremonyNotes.value || null,
      // Fe
      faith_answers: { ...faithAnswers.value },
      consent_accepted: consentAccepted.value,
      signature_data: signatureData.value,
    }

    const result = await saveCandidateForm(id.value, payload)
    identificationDone.value = result.identification_completed
    conversionDone.value = result.conversion_completed
    faithDone.value = result.faith_completed
    // Computed from form fields — ceremony_completed in DB is owned by validation view
    ceremonyDone.value = result.ceremony_data_completed
    status.value = result.status

    // Sync back to candidate ref for PDF
    if (candidate.value) {
      Object.assign(candidate.value, payload, result)
    }

    // Actualizar snapshot con los valores recién guardados
    savedSnap.value = buildSnap()

    saveMsg.value = 'Guardado correctamente.'
    triggerSavedToast()
    setTimeout(() => {
      saveMsg.value = ''
    }, 2500)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    saveMsg.value = `Error al guardar: ${msg}`
    saveMsgError.value = true
    console.error('[save] Error:', err)
  } finally {
    saving.value = false
  }
}

// ── PDF ────────────────────────────────────────────────────────────────────

async function handleGeneratePdf() {
  if (!candidate.value) return
  if (!consentAccepted.value) {
    saveMsg.value = 'Debes aceptar el consentimiento antes de generar el PDF.'
    setTimeout(() => {
      saveMsg.value = ''
    }, 3500)
    return
  }
  generatingPdf.value = true
  try {
    const snap = buildPdfSnap()
    if (snap) generateCandidatePdf(snap, { churchSecretary: churchSecretary.value })
  } catch (err) {
    console.error('[PDF] Error al generar:', err)
    saveMsg.value = 'Error al generar el PDF. Revisa la consola del navegador.'
    setTimeout(() => {
      saveMsg.value = ''
    }, 4000)
  } finally {
    generatingPdf.value = false
  }
}

// ── Preview ───────────────────────────────────────────────────────────────

function buildPdfSnap(): CandidateDetail | null {
  if (!candidate.value) return null
  return {
    ...candidate.value,
    observations: observations.value || null,
    address: address.value || null,
    has_disability: hasDisability.value,
    disability_types: hasDisability.value ? [...disabilityTypes.value] : [],
    biblical_instructor_1: biblicalInstructor1.value || null,
    biblical_instructor_2: biblicalInstructor2.value || null,
    previous_religion:
      previousReligion.value === 'Otra'
        ? previousReligionOther.value || null
        : previousReligion.value || null,
    how_knew_iasd: howKnewIasd.value || null,
    how_studied_bible: howStudiedBible.value || null,
    decisive_factor: decisiveFactor.value || null,
    faith_answers: { ...faithAnswers.value },
    consent_accepted: consentAccepted.value,
    ceremony_date: ceremonyDate.value || null,
    ceremony_place: ceremonyPlace.value || null,
    officiating_pastor: officatingPastor.value || null,
    officiating_pastor_dni: officatingPastorDni.value || null,
    receiving_church: receivingChurch.value || null,
    church_city: churchCity.value || null,
    administrative_meeting_date: administrativeMeetingDate.value || null,
    ceremony_notes: ceremonyNotes.value || null,
  }
}

async function handleShowPreview() {
  const snap = buildPdfSnap()
  if (!snap) return
  loadingPreview.value = true
  try {
    if (pdfPreviewUrl.value) URL.revokeObjectURL(pdfPreviewUrl.value)
    pdfPreviewUrl.value = previewCandidatePdf(snap, { churchSecretary: churchSecretary.value })
    showPreview.value = true
  } catch (err) {
    console.error('[PDF] Error en preview:', err)
  } finally {
    loadingPreview.value = false
  }
}

function closePreview() {
  showPreview.value = false
  if (pdfPreviewUrl.value) {
    URL.revokeObjectURL(pdfPreviewUrl.value)
    pdfPreviewUrl.value = null
  }
}

// ── Delete ────────────────────────────────────────────────────────────────

async function executeDelete() {
  deleting.value = true
  try {
    await deleteCandidate(id.value)
    await router.push({ path: '/candidates', query: { deleted: '1' } })
  } finally {
    deleting.value = false
  }
}

// ── Saved snapshot ─────────────────────────────────────────────────────────
// Refleja los valores que fueron persistidos en el último guardado/carga.
// Los íconos de estado en los labels se basan en este snapshot, no en el
// estado actual del formulario (que puede estar sin guardar).

interface SavedSnap {
  maritalStatus: string
  weddingDate: string | null
  educationLevel: string | null
  address: string | null
  guardian1Name: string | null
  guardian1Document: string | null
  biblicalInstructor1: string | null
  previousReligion: string | null
  howKnewIasd: string | null
  howStudiedBible: string | null
  decisiveFactor: string | null
  ceremonyDate: string | null
  ceremonyPlace: string | null
  officatingPastor: string | null
  officatingPastorDni: string | null
  receivingChurch: string | null
  churchCity: string | null
  administrativeMeetingDate: string | null
  faithAnswersCount: number
  consentAccepted: boolean
}

const savedSnap = ref<SavedSnap | null>(null)

function buildSnap(): SavedSnap {
  return {
    maritalStatus: maritalStatus.value,
    weddingDate: maritalStatus.value === 'married' ? weddingDate.value || null : null,
    educationLevel: educationLevel.value,
    address: address.value || null,
    guardian1Name: guardian1Name.value || null,
    guardian1Document: guardian1Document.value || null,
    biblicalInstructor1: biblicalInstructor1.value || null,
    previousReligion:
      previousReligion.value === 'Otra'
        ? previousReligionOther.value || null
        : previousReligion.value || null,
    howKnewIasd: howKnewIasd.value || null,
    howStudiedBible: howStudiedBible.value || null,
    decisiveFactor: decisiveFactor.value || null,
    ceremonyDate: ceremonyDate.value || null,
    ceremonyPlace: ceremonyPlace.value || null,
    officatingPastor: officatingPastor.value || null,
    officatingPastorDni: officatingPastorDni.value || null,
    receivingChurch: receivingChurch.value || null,
    churchCity: churchCity.value || null,
    administrativeMeetingDate: administrativeMeetingDate.value || null,
    faithAnswersCount: Object.values(faithAnswers.value).filter((v) => v !== null).length,
    consentAccepted: consentAccepted.value,
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function setFaithAnswer(idx: number, val: boolean) {
  const cur = faithAnswers.value[String(idx)]
  faithAnswers.value = { ...faithAnswers.value, [String(idx)]: cur === val ? null : val }
}
</script>

<template>
  <div class="space-y-5">
    <!-- ── Header ─────────────────────────────────────────────────────────── -->
    <div class="flex items-center gap-3 flex-wrap">
      <RouterLink
        to="/candidates"
        class="p-2 rounded-xl text-gray-400 hover:text-[#04395a] hover:bg-gray-100 transition-colors shrink-0"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="2"
          stroke="currentColor"
          class="w-4 h-4"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
      </RouterLink>

      <div class="flex-1 min-w-0">
        <template v-if="loading">
          <div class="h-6 w-52 bg-gray-200 rounded animate-pulse mb-1" />
          <div class="h-3 w-36 bg-gray-100 rounded animate-pulse" />
        </template>
        <template v-else>
          <h2 class="text-2xl font-bold text-[#04395a] truncate">
            {{ person?.full_name ?? 'Candidato' }}
          </h2>
          <p class="text-xs text-gray-400 font-mono mt-0.5">{{ id }}</p>
        </template>
      </div>

      <!-- Status badge -->
      <span
        v-if="!loading"
        class="shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
        :class="
          status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
        "
      >
        <span
          class="w-1.5 h-1.5 rounded-full"
          :class="status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500'"
        />
        {{ status === 'completed' ? 'Completado' : 'Borrador' }}
      </span>

      <!-- Actions -->
      <div v-if="!loading" class="flex items-center gap-2 shrink-0">
        <!-- Vista previa -->
        <button
          type="button"
          :disabled="loadingPreview"
          @click="handleShowPreview"
          class="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 transition-colors"
          title="Vista previa de la ficha"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
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
          <span class="hidden sm:inline">Vista previa</span>
        </button>

        <!-- Descargar PDF -->
        <button
          type="button"
          :disabled="generatingPdf"
          @click="handleGeneratePdf"
          class="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-[#04395a] bg-[#04395a]/10 hover:bg-[#04395a]/20 disabled:opacity-50 transition-colors"
          title="Generar PDF"
        >
          <svg v-if="generatingPdf" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
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
          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-4 h-4"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m.75 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
            />
          </svg>
          <span class="hidden sm:inline">{{ generatingPdf ? 'Generando…' : 'PDF' }}</span>
        </button>
        <button
          v-if="canWrite && status !== 'completed'"
          type="button"
          @click="showDeleteConfirm = true"
          class="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          title="Eliminar ficha"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-4 h-4"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
            />
          </svg>
        </button>
      </div>
    </div>

    <!-- ── Progress bar ───────────────────────────────────────────────────── -->
    <div
      v-if="!loading && !loadError"
      class="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4"
    >
      <div class="flex items-center justify-between mb-2">
        <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Progreso de la ficha
        </p>
        <span
          class="text-xs font-bold"
          :class="progressPct === 100 ? 'text-emerald-600' : 'text-[#04395a]'"
        >
          {{ progressPct }}%
        </span>
      </div>
      <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          class="h-full rounded-full transition-all duration-500"
          :class="progressPct === 100 ? 'bg-emerald-500' : 'bg-[#04395a]'"
          :style="{ width: progressPct + '%' }"
        />
      </div>
      <div class="flex items-center gap-4 mt-3">
        <div
          v-for="(item, i) in [
            { label: 'Identificación', done: identificationDone },
            { label: 'Conversión', done: conversionDone },
            { label: 'Declaración de fe', done: faithDone },
            { label: 'Ceremonia', done: ceremonyDone },
          ]"
          :key="i"
          class="flex items-center gap-1.5"
        >
          <div
            class="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
            :class="item.done ? 'bg-emerald-100' : 'bg-gray-100'"
          >
            <svg
              v-if="item.done"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="2.5"
              stroke="#10b981"
              class="w-2.5 h-2.5"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
            <div v-else class="w-1.5 h-1.5 rounded-full bg-gray-300" />
          </div>
          <span
            class="text-xs"
            :class="item.done ? 'text-emerald-700 font-medium' : 'text-gray-400'"
          >
            {{ item.label }}
          </span>
        </div>
      </div>
    </div>

    <!-- ── Error de carga ───────────────────────────────────────────────────── -->
    <div
      v-if="loadError"
      class="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 flex items-start gap-3"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1.5"
        stroke="#ef4444"
        class="w-5 h-5 shrink-0 mt-0.5"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
        />
      </svg>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold text-red-700">No se pudo cargar la ficha</p>
        <p class="text-xs text-red-500 mt-0.5 font-mono break-all">{{ loadError }}</p>
        <button
          type="button"
          @click="loadDetail"
          class="mt-2 text-xs font-medium text-red-600 underline hover:text-red-800"
        >
          Reintentar
        </button>
      </div>
    </div>

    <!-- ── Tabs card ──────────────────────────────────────────────────────── -->
    <div v-if="!loadError" class="bg-white rounded-2xl shadow-sm border border-gray-100">
      <div class="px-6 pt-4">
        <Tabs v-model="activeTab" :tabs="tabs" />
      </div>

      <div class="px-6 pb-6">
        <!-- ════════════════════════════════════════════════════════════════ -->
        <!-- TAB 1: IDENTIFICACIÓN                                            -->
        <!-- ════════════════════════════════════════════════════════════════ -->
        <div v-show="activeTab === 'identificacion'" class="pt-4">
          <!-- Skeleton -->
          <template v-if="loading">
            <div class="grid md:grid-cols-2 gap-4">
              <div
                v-for="i in 8"
                :key="i"
                class="h-14 rounded-xl bg-gray-100 animate-pulse"
                :style="{ opacity: 1 - i * 0.08 }"
              />
            </div>
          </template>

          <template v-else>
            <div class="grid md:grid-cols-2 gap-6">
              <!-- Datos del candidato (readonly) -->
              <div class="space-y-3">
                <div class="flex items-center gap-2">
                  <div class="w-1 h-4 rounded-full bg-[#04395a]" />
                  <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {{ candidate?.teachers ? 'Datos del docente' : 'Datos del estudiante' }}
                  </h3>
                </div>

                <div class="bg-gray-50 rounded-xl divide-y divide-gray-100">
                  <!-- Campos comunes -->
                  <div
                    v-for="(row, i) in [
                      { label: 'DNI', value: person?.dni },
                      { label: 'Nombres completos', value: person?.full_name },
                      {
                        label: 'Sexo',
                        value:
                          person?.sex === '1'
                            ? 'Masculino'
                            : person?.sex === '2'
                              ? 'Femenino'
                              : person?.sex || null,
                      },
                      {
                        label: 'F. nacimiento',
                        value: person?.birth_date ? fmtDate(person.birth_date) : null,
                      },
                      {
                        label: 'País',
                        value:
                          [person?.country, person?.postal_code].filter(Boolean).join(' — CP: ') ||
                          null,
                      },
                      { label: 'Teléfono', value: person?.phone },
                      { label: 'Correo', value: person?.institutional_email },
                      // Extra docente
                      ...(candidate?.teachers
                        ? [
                            { label: 'Grado académico', value: candidate.teachers.academic_degree },
                            { label: 'Régimen', value: candidate.teachers.dedication_regime },
                            { label: 'Cond. laboral', value: candidate.teachers.labor_condition },
                            { label: 'Facultad', value: candidate.teachers.faculty },
                            { label: 'EP Principal', value: candidate.teachers.main_ep },
                            { label: 'Campus', value: candidate.teachers.campus },
                          ]
                        : []),
                    ]"
                    :key="i"
                    class="flex items-center gap-3 px-4 py-2.5"
                  >
                    <span class="text-xs text-gray-400 w-24 shrink-0">{{ row.label }}</span>
                    <span class="text-sm text-gray-800 font-medium truncate">{{
                      row.value || '—'
                    }}</span>
                  </div>
                </div>

                <!-- Tipo de ceremonia -->
                <div>
                  <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    Tipo de ceremonia
                  </p>
                  <div class="space-y-1.5">
                    <label
                      v-for="opt in [
                        { value: 'baptism', label: 'Bautismo' },
                        { value: 'rebaptism', label: 'Rebautismo' },
                        { value: 'faith_profession', label: 'Profesión de fe' },
                      ]"
                      :key="opt.value"
                      class="flex items-center gap-3 px-4 py-2.5 rounded-xl border cursor-pointer transition-all select-none"
                      :class="
                        ceremonyType === opt.value
                          ? 'border-[#04395a]/30 bg-[#04395a]/5'
                          : 'border-gray-100 bg-gray-50 hover:bg-gray-100'
                      "
                    >
                      <input
                        type="radio"
                        :value="opt.value"
                        v-model="ceremonyType"
                        class="sr-only"
                      />
                      <!-- Custom radio -->
                      <div
                        class="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
                        :class="ceremonyType === opt.value ? 'border-[#04395a]' : 'border-gray-300'"
                      >
                        <div
                          v-if="ceremonyType === opt.value"
                          class="w-2 h-2 rounded-full bg-[#04395a]"
                        />
                      </div>
                      <span
                        class="text-sm font-medium"
                        :class="ceremonyType === opt.value ? 'text-[#04395a]' : 'text-gray-600'"
                      >
                        {{ opt.label }}
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <!-- Campos editables -->
              <div class="space-y-4">
                <div class="flex items-center gap-2">
                  <div class="w-1 h-4 rounded-full bg-[#fdc710]" />
                  <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Información adicional
                  </h3>
                </div>

                <div class="space-y-3">
                  <!-- Estado civil -->
                  <div>
                    <label class="flex items-center gap-1 text-xs font-medium text-gray-500 mb-2">
                      <FieldStatus v-if="savedSnap" :filled="!!savedSnap.maritalStatus" />
                      Estado civil
                    </label>
                    <div class="grid grid-cols-2 gap-1.5">
                      <label
                        v-for="opt in [
                          { value: 'single', label: 'Soltero/a' },
                          { value: 'married', label: 'Casado/a' },
                          { value: 'divorced', label: 'Divorciado/a' },
                          { value: 'widowed', label: 'Viudo/a' },
                          { value: 'other', label: 'Otro' },
                        ]"
                        :key="opt.value"
                        class="flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition-all select-none"
                        :class="
                          maritalStatus === opt.value
                            ? 'border-[#04395a]/30 bg-[#04395a]/5'
                            : 'border-gray-100 bg-gray-50 hover:bg-gray-100'
                        "
                      >
                        <input
                          type="radio"
                          :value="opt.value"
                          v-model="maritalStatus"
                          class="sr-only"
                        />
                        <div
                          class="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
                          :class="
                            maritalStatus === opt.value ? 'border-[#04395a]' : 'border-gray-300'
                          "
                        >
                          <div
                            v-if="maritalStatus === opt.value"
                            class="w-2 h-2 rounded-full bg-[#04395a]"
                          />
                        </div>
                        <span
                          class="text-sm"
                          :class="
                            maritalStatus === opt.value
                              ? 'text-[#04395a] font-medium'
                              : 'text-gray-600'
                          "
                        >
                          {{ opt.label }}
                        </span>
                      </label>
                    </div>
                    <!-- Fecha de matrimonio si es Casado/a -->
                    <Transition name="slide-down">
                      <div v-if="maritalStatus === 'married'" class="mt-2">
                        <label class="block text-xs text-gray-400 mb-1.5"
                          >Fecha de matrimonio</label
                        >
                        <input
                          v-model="weddingDate"
                          type="date"
                          class="w-full px-3 py-2.5 text-sm rounded-xl border border-[#04395a]/30 bg-[#04395a]/5 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition"
                        />
                      </div>
                    </Transition>
                  </div>

                  <!-- Discapacidad -->
                  <div>
                    <label class="flex items-center gap-1 text-xs font-medium text-gray-500 mb-2">
                      <FieldStatus v-if="savedSnap" :filled="true" />
                      ¿Tiene algún tipo de discapacidad o condición específica?
                    </label>
                    <div class="flex gap-2 mb-2">
                      <label
                        v-for="opt in [
                          { value: false, label: 'No' },
                          { value: true, label: 'Sí' },
                        ]"
                        :key="String(opt.value)"
                        class="flex items-center gap-2.5 px-4 py-2 rounded-xl border cursor-pointer transition-all select-none"
                        :class="
                          hasDisability === opt.value
                            ? 'border-[#04395a]/30 bg-[#04395a]/5'
                            : 'border-gray-100 bg-gray-50 hover:bg-gray-100'
                        "
                      >
                        <input
                          type="radio"
                          :value="opt.value"
                          v-model="hasDisability"
                          class="sr-only"
                        />
                        <div
                          class="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
                          :class="
                            hasDisability === opt.value ? 'border-[#04395a]' : 'border-gray-300'
                          "
                        >
                          <div
                            v-if="hasDisability === opt.value"
                            class="w-2 h-2 rounded-full bg-[#04395a]"
                          />
                        </div>
                        <span
                          class="text-sm font-medium"
                          :class="hasDisability === opt.value ? 'text-[#04395a]' : 'text-gray-600'"
                        >
                          {{ opt.label }}
                        </span>
                      </label>
                    </div>

                    <!-- Tipos de discapacidad (checkboxes multi-selección) -->
                    <Transition name="slide-down">
                      <div v-if="hasDisability" class="grid grid-cols-2 gap-1.5">
                        <label
                          v-for="tipo in [
                            'Física',
                            'Visual',
                            'Auditiva',
                            'Intelectual',
                            'Psíquica',
                            'Autismo',
                          ]"
                          :key="tipo"
                          class="flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition-all select-none"
                          :class="
                            disabilityTypes.includes(tipo)
                              ? 'border-[#04395a]/30 bg-[#04395a]/5'
                              : 'border-gray-100 bg-gray-50 hover:bg-gray-100'
                          "
                        >
                          <input
                            type="checkbox"
                            :value="tipo"
                            v-model="disabilityTypes"
                            class="sr-only"
                          />
                          <div
                            class="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors"
                            :class="
                              disabilityTypes.includes(tipo)
                                ? 'border-[#04395a] bg-[#04395a]'
                                : 'border-gray-300'
                            "
                          >
                            <svg
                              v-if="disabilityTypes.includes(tipo)"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke-width="3"
                              stroke="white"
                              class="w-2.5 h-2.5"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="m4.5 12.75 6 6 9-13.5"
                              />
                            </svg>
                          </div>
                          <span
                            class="text-sm"
                            :class="
                              disabilityTypes.includes(tipo)
                                ? 'text-[#04395a] font-medium'
                                : 'text-gray-600'
                            "
                          >
                            {{ tipo }}
                          </span>
                        </label>
                      </div>
                    </Transition>
                  </div>

                  <!-- Grado de instrucción -->
                  <div>
                    <label class="flex items-center gap-1 text-xs font-medium text-gray-500 mb-2">
                      <FieldStatus v-if="savedSnap" :filled="savedSnap.educationLevel !== null" />
                      Grado de instrucción
                    </label>
                    <div class="grid grid-cols-2 gap-1.5">
                      <label
                        v-for="opt in [
                          { value: 'none', label: 'Sin instrucción' },
                          { value: 'primary', label: 'Primaria' },
                          { value: 'secondary', label: 'Secundaria' },
                          { value: 'higher', label: 'Superior' },
                          { value: 'other', label: 'Otro' },
                        ]"
                        :key="opt.value"
                        class="flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition-all select-none"
                        :class="
                          educationLevel === opt.value
                            ? 'border-[#04395a]/30 bg-[#04395a]/5'
                            : 'border-gray-100 bg-gray-50 hover:bg-gray-100'
                        "
                      >
                        <input
                          type="radio"
                          :value="opt.value"
                          v-model="educationLevel"
                          class="sr-only"
                        />
                        <div
                          class="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
                          :class="
                            educationLevel === opt.value ? 'border-[#04395a]' : 'border-gray-300'
                          "
                        >
                          <div
                            v-if="educationLevel === opt.value"
                            class="w-2 h-2 rounded-full bg-[#04395a]"
                          />
                        </div>
                        <span
                          class="text-sm"
                          :class="
                            educationLevel === opt.value
                              ? 'text-[#04395a] font-medium'
                              : 'text-gray-600'
                          "
                        >
                          {{ opt.label }}
                        </span>
                      </label>
                    </div>
                    <Transition name="slide-down">
                      <div v-if="educationLevel === 'other'" class="mt-2">
                        <input
                          v-model="educationLevelOther"
                          type="text"
                          placeholder="Especifica el grado de instrucción…"
                          class="w-full px-3 py-2.5 text-sm rounded-xl border border-[#04395a]/30 bg-[#04395a]/5 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition"
                        />
                      </div>
                    </Transition>
                  </div>

                  <div>
                    <label class="flex items-center gap-1 text-xs font-medium text-gray-500 mb-1.5">
                      <FieldStatus v-if="savedSnap" :filled="!!savedSnap.address" />
                      Dirección residencial completa
                    </label>
                    <input
                      v-model="address"
                      type="text"
                      placeholder="Calle / Av., N°, distrito, ciudad, departamento…"
                      class="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Responsables (solo si es menor de edad) -->
            <Transition name="slide-down">
              <div
                v-if="isMinor"
                class="mt-6 p-4 rounded-2xl border border-amber-200 bg-amber-50 space-y-4"
              >
                <div class="flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="#d97706"
                    class="w-4 h-4 shrink-0"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
                    />
                  </svg>
                  <h3 class="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                    Menor de 18 años — Responsable(s)
                  </h3>
                </div>

                <!-- Responsable 1 -->
                <div class="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label class="flex items-center gap-1 text-xs font-medium text-gray-500 mb-1.5">
                      <FieldStatus v-if="savedSnap" :filled="!!savedSnap.guardian1Name" />
                      Nombre del responsable
                    </label>
                    <input
                      v-model="guardian1Name"
                      type="text"
                      placeholder="Nombre completo…"
                      class="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition bg-white"
                    />
                  </div>
                  <div>
                    <label class="flex items-center gap-1 text-xs font-medium text-gray-500 mb-1.5">
                      <FieldStatus v-if="savedSnap" :filled="!!savedSnap.guardian1Document" />
                      Documento de identificación
                    </label>
                    <input
                      v-model="guardian1Document"
                      type="text"
                      placeholder="DNI / CE…"
                      class="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition bg-white"
                    />
                  </div>
                </div>

                <!-- Toggle responsable 2 -->
                <div v-if="!showGuardian2">
                  <button
                    type="button"
                    @click="showGuardian2 = true"
                    class="flex items-center gap-1.5 text-xs font-medium text-amber-600 hover:text-amber-800 transition-colors"
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
                        d="M12 4.5v15m7.5-7.5h-15"
                      />
                    </svg>
                    Agregar segundo responsable
                  </button>
                </div>
                <Transition name="slide-down">
                  <div v-if="showGuardian2" class="grid sm:grid-cols-2 gap-3">
                    <div>
                      <div class="flex items-center justify-between mb-1.5">
                        <label class="block text-xs font-medium text-gray-500"
                          >Nombre del responsable 2</label
                        >
                        <button
                          type="button"
                          @click="removeGuardian2"
                          class="text-xs text-gray-400 hover:text-red-500 transition-colors"
                        >
                          Quitar
                        </button>
                      </div>
                      <input
                        v-model="guardian2Name"
                        type="text"
                        placeholder="Nombre completo…"
                        class="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition bg-white"
                      />
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-gray-500 mb-1.5"
                        >Documento de identificación</label
                      >
                      <input
                        v-model="guardian2Document"
                        type="text"
                        placeholder="DNI / CE…"
                        class="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition bg-white"
                      />
                    </div>
                  </div>
                </Transition>
              </div>
            </Transition>

            <!-- Guardar -->
            <div
              v-if="canWrite"
              class="flex items-center gap-3 mt-6 pt-4 pb-6 border-t border-gray-100"
            >
              <button
                type="button"
                :disabled="saving"
                @click="save"
                class="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-[#04395a] hover:bg-[#068ab8] disabled:opacity-50 transition-colors"
              >
                <svg v-if="saving" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
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
                <svg
                  v-else
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
                    d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                  />
                </svg>
                {{ saving ? 'Guardando…' : 'Guardar' }}
              </button>
              <Transition name="fade">
                <span
                  v-if="saveMsg"
                  class="text-xs font-medium"
                  :class="saveMsgError ? 'text-red-600' : 'text-emerald-600'"
                  >{{ saveMsg }}</span
                >
              </Transition>
            </div>
          </template>
        </div>

        <!-- ════════════════════════════════════════════════════════════════ -->
        <!-- TAB 2: CONVERSIÓN                                                -->
        <!-- ════════════════════════════════════════════════════════════════ -->
        <div v-show="activeTab === 'conversion'" class="pt-4">
          <template v-if="loading">
            <div class="space-y-3">
              <div
                v-for="i in 5"
                :key="i"
                class="h-12 rounded-xl bg-gray-100 animate-pulse"
                :style="{ opacity: 1 - i * 0.12 }"
              />
            </div>
          </template>
          <template v-else>
            <div class="grid md:grid-cols-2 gap-6">
              <!-- ── Columna izquierda: Experiencia de conversión ── -->
              <div class="space-y-4">
                <div class="flex items-center gap-2">
                  <div class="w-1 h-4 rounded-full bg-[#068ab8]" />
                  <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Experiencia de conversión
                  </h3>
                </div>

                <div class="space-y-3">
                  <div>
                    <label class="flex items-center gap-1 text-xs font-medium text-gray-500 mb-1.5">
                      <FieldStatus v-if="savedSnap" :filled="!!savedSnap.biblicalInstructor1" />
                      Instructor/a bíblico/a 1
                    </label>
                    <input
                      v-model="biblicalInstructor1"
                      type="text"
                      placeholder="Nombre completo del instructor…"
                      class="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition"
                    />
                  </div>

                  <!-- Instructor 2: toggle -->
                  <div v-if="!showInstructor2">
                    <button
                      type="button"
                      @click="showInstructor2 = true"
                      class="flex items-center gap-1.5 text-xs font-medium text-[#068ab8] hover:text-[#04395a] transition-colors"
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
                          d="M12 4.5v15m7.5-7.5h-15"
                        />
                      </svg>
                      Agregar segundo instructor
                    </button>
                  </div>
                  <Transition name="slide-down">
                    <div v-if="showInstructor2">
                      <div class="flex items-center justify-between mb-1.5">
                        <label class="block text-xs font-medium text-gray-500"
                          >Instructor/a bíblico/a 2</label
                        >
                        <button
                          type="button"
                          @click="removeInstructor2"
                          class="text-xs text-gray-400 hover:text-red-500 transition-colors"
                        >
                          Quitar
                        </button>
                      </div>
                      <input
                        v-model="biblicalInstructor2"
                        type="text"
                        placeholder="Nombre completo del instructor…"
                        class="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition"
                      />
                    </div>
                  </Transition>
                  <!-- Religión anterior -->
                  <div>
                    <label class="flex items-center gap-1 text-xs font-medium text-gray-500 mb-2">
                      <FieldStatus v-if="savedSnap" :filled="!!savedSnap.previousReligion" />
                      Religión anterior
                    </label>
                    <div class="grid grid-cols-2 gap-1.5">
                      <label
                        v-for="opt in RELIGION_OPTIONS"
                        :key="opt"
                        class="flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition-all select-none"
                        :class="
                          previousReligion === opt
                            ? 'border-[#04395a]/30 bg-[#04395a]/5'
                            : 'border-gray-100 bg-gray-50 hover:bg-gray-100'
                        "
                      >
                        <input
                          type="radio"
                          :value="opt"
                          v-model="previousReligion"
                          class="sr-only"
                        />
                        <div
                          class="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
                          :class="previousReligion === opt ? 'border-[#04395a]' : 'border-gray-300'"
                        >
                          <div
                            v-if="previousReligion === opt"
                            class="w-2 h-2 rounded-full bg-[#04395a]"
                          />
                        </div>
                        <span
                          class="text-sm"
                          :class="
                            previousReligion === opt
                              ? 'text-[#04395a] font-medium'
                              : 'text-gray-600'
                          "
                          >{{ opt }}</span
                        >
                      </label>
                    </div>
                    <Transition name="slide-down">
                      <div v-if="previousReligion === 'Otra'" class="mt-2">
                        <input
                          v-model="previousReligionOther"
                          type="text"
                          placeholder="Especifica la religión…"
                          class="w-full px-3 py-2.5 text-sm rounded-xl border border-[#04395a]/30 bg-[#04395a]/5 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition"
                        />
                      </div>
                    </Transition>
                  </div>
                </div>
              </div>

              <!-- ── Columna derecha: Preguntas de selección ── -->
              <div class="space-y-4">
                <div class="flex items-center gap-2">
                  <div class="w-1 h-4 rounded-full bg-[#fdc710]" />
                  <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Preguntas de selección
                  </h3>
                </div>

                <div class="space-y-4">
                  <!-- ¿Cómo conociste la IASD? (colapsable) -->
                  <div>
                    <button
                      type="button"
                      @click="showHowKnewIasd = !showHowKnewIasd"
                      class="w-full flex items-center gap-1 mb-1 group"
                    >
                      <FieldStatus v-if="savedSnap" :filled="!!savedSnap.howKnewIasd" />
                      <span class="flex-1 text-xs font-medium text-gray-500 text-left">
                        ¿Cómo conociste la IASD?
                        <span class="text-gray-400 font-normal">(marca solo una opción)</span>
                        <span
                          v-if="savedSnap?.howKnewIasd && !showHowKnewIasd"
                          class="ml-1 text-[#068ab8] font-semibold"
                          >— {{ howKnewIasd }}</span
                        >
                      </span>
                      <span
                        class="shrink-0 flex items-center gap-1 text-[11px] font-medium text-[#068ab8] group-hover:text-[#04395a] transition-colors"
                      >
                        {{ showHowKnewIasd ? 'Ocultar' : 'Ver opciones' }}
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke-width="2.5"
                          stroke="currentColor"
                          class="w-3.5 h-3.5 transition-transform duration-200"
                          :class="showHowKnewIasd ? 'rotate-180' : ''"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="m19.5 8.25-7.5 7.5-7.5-7.5"
                          />
                        </svg>
                      </span>
                    </button>
                    <Transition
                      enter-active-class="transition-all duration-200 ease-out overflow-hidden"
                      enter-from-class="opacity-0 max-h-0"
                      enter-to-class="opacity-100 max-h-[9999px]"
                      leave-active-class="transition-all duration-150 ease-in overflow-hidden"
                      leave-from-class="opacity-100 max-h-[9999px]"
                      leave-to-class="opacity-0 max-h-0"
                    >
                      <div v-show="showHowKnewIasd" class="grid grid-cols-2 gap-1.5 mt-2">
                        <label
                          v-for="opt in HOW_KNEW_IASD_OPTIONS"
                          :key="opt"
                          class="flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition-all select-none"
                          :class="
                            howKnewIasd === opt
                              ? 'border-[#068ab8]/30 bg-[#068ab8]/5'
                              : 'border-gray-100 bg-gray-50 hover:bg-gray-100'
                          "
                        >
                          <input type="radio" :value="opt" v-model="howKnewIasd" class="sr-only" />
                          <div
                            class="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
                            :class="howKnewIasd === opt ? 'border-[#068ab8]' : 'border-gray-300'"
                          >
                            <div
                              v-if="howKnewIasd === opt"
                              class="w-2 h-2 rounded-full bg-[#068ab8]"
                            />
                          </div>
                          <span
                            class="text-sm"
                            :class="
                              howKnewIasd === opt ? 'text-[#068ab8] font-medium' : 'text-gray-600'
                            "
                            >{{ opt }}</span
                          >
                        </label>
                      </div>
                    </Transition>
                  </div>

                  <!-- ¿Cómo estudiaste la Biblia? (colapsable) -->
                  <div>
                    <button
                      type="button"
                      @click="showHowStudiedBible = !showHowStudiedBible"
                      class="w-full flex items-center gap-1 mb-1 group"
                    >
                      <FieldStatus v-if="savedSnap" :filled="!!savedSnap.howStudiedBible" />
                      <span class="flex-1 text-xs font-medium text-gray-500 text-left">
                        ¿Cómo estudiaste la Biblia?
                        <span class="text-gray-400 font-normal">(marca solo una opción)</span>
                        <span
                          v-if="savedSnap?.howStudiedBible && !showHowStudiedBible"
                          class="ml-1 text-[#068ab8] font-semibold"
                          >— {{ howStudiedBible }}</span
                        >
                      </span>
                      <span
                        class="shrink-0 flex items-center gap-1 text-[11px] font-medium text-[#068ab8] group-hover:text-[#04395a] transition-colors"
                      >
                        {{ showHowStudiedBible ? 'Ocultar' : 'Ver opciones' }}
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke-width="2.5"
                          stroke="currentColor"
                          class="w-3.5 h-3.5 transition-transform duration-200"
                          :class="showHowStudiedBible ? 'rotate-180' : ''"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="m19.5 8.25-7.5 7.5-7.5-7.5"
                          />
                        </svg>
                      </span>
                    </button>
                    <Transition
                      enter-active-class="transition-all duration-200 ease-out overflow-hidden"
                      enter-from-class="opacity-0 max-h-0"
                      enter-to-class="opacity-100 max-h-[9999px]"
                      leave-active-class="transition-all duration-150 ease-in overflow-hidden"
                      leave-from-class="opacity-100 max-h-[9999px]"
                      leave-to-class="opacity-0 max-h-0"
                    >
                      <div v-show="showHowStudiedBible" class="grid grid-cols-2 gap-1.5 mt-2">
                        <label
                          v-for="opt in HOW_STUDIED_BIBLE_OPTIONS"
                          :key="opt"
                          class="flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition-all select-none"
                          :class="
                            howStudiedBible === opt
                              ? 'border-[#068ab8]/30 bg-[#068ab8]/5'
                              : 'border-gray-100 bg-gray-50 hover:bg-gray-100'
                          "
                        >
                          <input
                            type="radio"
                            :value="opt"
                            v-model="howStudiedBible"
                            class="sr-only"
                          />
                          <div
                            class="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
                            :class="
                              howStudiedBible === opt ? 'border-[#068ab8]' : 'border-gray-300'
                            "
                          >
                            <div
                              v-if="howStudiedBible === opt"
                              class="w-2 h-2 rounded-full bg-[#068ab8]"
                            />
                          </div>
                          <span
                            class="text-sm"
                            :class="
                              howStudiedBible === opt
                                ? 'text-[#068ab8] font-medium'
                                : 'text-gray-600'
                            "
                            >{{ opt }}</span
                          >
                        </label>
                      </div>
                    </Transition>
                  </div>

                  <!-- ¿Factor decisivo? (colapsable) -->
                  <div>
                    <button
                      type="button"
                      @click="showDecisiveFactor = !showDecisiveFactor"
                      class="w-full flex items-center gap-1 mb-1 group"
                    >
                      <FieldStatus v-if="savedSnap" :filled="!!savedSnap.decisiveFactor" />
                      <span class="flex-1 text-xs font-medium text-gray-500 text-left">
                        ¿Cuál fue el factor decisivo para que seas bautizado/a?
                        <span class="text-gray-400 font-normal">(marca solo una opción)</span>
                        <span
                          v-if="savedSnap?.decisiveFactor && !showDecisiveFactor"
                          class="ml-1 text-[#068ab8] font-semibold"
                          >— {{ decisiveFactor }}</span
                        >
                      </span>
                      <span
                        class="shrink-0 flex items-center gap-1 text-[11px] font-medium text-[#068ab8] group-hover:text-[#04395a] transition-colors"
                      >
                        {{ showDecisiveFactor ? 'Ocultar' : 'Ver opciones' }}
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke-width="2.5"
                          stroke="currentColor"
                          class="w-3.5 h-3.5 transition-transform duration-200"
                          :class="showDecisiveFactor ? 'rotate-180' : ''"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="m19.5 8.25-7.5 7.5-7.5-7.5"
                          />
                        </svg>
                      </span>
                    </button>
                    <Transition
                      enter-active-class="transition-all duration-200 ease-out overflow-hidden"
                      enter-from-class="opacity-0 max-h-0"
                      enter-to-class="opacity-100 max-h-[9999px]"
                      leave-active-class="transition-all duration-150 ease-in overflow-hidden"
                      leave-from-class="opacity-100 max-h-[9999px]"
                      leave-to-class="opacity-0 max-h-0"
                    >
                      <div v-show="showDecisiveFactor" class="grid grid-cols-2 gap-1.5 mt-2">
                        <label
                          v-for="opt in DECISIVE_FACTOR_OPTIONS"
                          :key="opt"
                          class="flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition-all select-none"
                          :class="
                            decisiveFactor === opt
                              ? 'border-[#068ab8]/30 bg-[#068ab8]/5'
                              : 'border-gray-100 bg-gray-50 hover:bg-gray-100'
                          "
                        >
                          <input
                            type="radio"
                            :value="opt"
                            v-model="decisiveFactor"
                            class="sr-only"
                          />
                          <div
                            class="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
                            :class="decisiveFactor === opt ? 'border-[#068ab8]' : 'border-gray-300'"
                          >
                            <div
                              v-if="decisiveFactor === opt"
                              class="w-2 h-2 rounded-full bg-[#068ab8]"
                            />
                          </div>
                          <span
                            class="text-sm"
                            :class="
                              decisiveFactor === opt
                                ? 'text-[#068ab8] font-medium'
                                : 'text-gray-600'
                            "
                            >{{ opt }}</span
                          >
                        </label>
                      </div>
                    </Transition>
                  </div>
                </div>
              </div>
            </div>

            <!-- Guardar -->
            <div
              v-if="canWrite"
              class="flex items-center gap-3 mt-6 pt-4 pb-6 border-t border-gray-100"
            >
              <button
                type="button"
                :disabled="saving"
                @click="save"
                class="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-[#04395a] hover:bg-[#068ab8] disabled:opacity-50 transition-colors"
              >
                <svg v-if="saving" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
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
                <svg
                  v-else
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
                    d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                  />
                </svg>
                {{ saving ? 'Guardando…' : 'Guardar' }}
              </button>
              <Transition name="fade">
                <span
                  v-if="saveMsg"
                  class="text-xs font-medium"
                  :class="saveMsgError ? 'text-red-600' : 'text-emerald-600'"
                  >{{ saveMsg }}</span
                >
              </Transition>
            </div>
          </template>
        </div>

        <!-- ════════════════════════════════════════════════════════════════ -->
        <!-- TAB 4: CEREMONIA                                                  -->
        <!-- ════════════════════════════════════════════════════════════════ -->
        <div v-show="activeTab === 'ceremonia'" class="pt-4">
          <template v-if="loading">
            <div class="grid md:grid-cols-2 gap-4">
              <div
                v-for="i in 6"
                :key="i"
                class="h-14 rounded-xl bg-gray-100 animate-pulse"
                :style="{ opacity: 1 - i * 0.1 }"
              />
            </div>
          </template>
          <template v-else>
            <div class="grid md:grid-cols-2 gap-6">
              <!-- ── Columna izquierda: datos del acto ── -->
              <div class="space-y-4">
                <div class="flex items-center gap-2">
                  <div class="w-1 h-4 rounded-full bg-[#04395a]" />
                  <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Datos del acto
                  </h3>
                </div>

                <div class="space-y-3">
                  <!-- Fecha de ceremonia -->
                  <div>
                    <label class="flex items-center gap-1 text-xs font-medium text-gray-500 mb-1.5">
                      <FieldStatus v-if="savedSnap" :filled="!!savedSnap.ceremonyDate" />
                      Fecha de ceremonia
                    </label>
                    <input
                      v-model="ceremonyDate"
                      type="date"
                      class="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition"
                    />
                  </div>

                  <!-- Lugar de la ceremonia -->
                  <div>
                    <label class="flex items-center gap-1 text-xs font-medium text-gray-500 mb-1.5">
                      <FieldStatus v-if="savedSnap" :filled="!!savedSnap.ceremonyPlace" />
                      Lugar de la ceremonia
                    </label>
                    <input
                      v-model="ceremonyPlace"
                      type="text"
                      placeholder="Nombre del lugar…"
                      class="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition"
                    />
                  </div>

                  <!-- Iglesia receptora -->
                  <div>
                    <label class="flex items-center gap-1 text-xs font-medium text-gray-500 mb-1.5">
                      <FieldStatus v-if="savedSnap" :filled="!!savedSnap.receivingChurch" />
                      Iglesia receptora
                    </label>
                    <input
                      v-model="receivingChurch"
                      type="text"
                      class="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition"
                    />
                  </div>

                  <!-- Ciudad de la iglesia -->
                  <div>
                    <label class="flex items-center gap-1 text-xs font-medium text-gray-500 mb-1.5">
                      <FieldStatus v-if="savedSnap" :filled="!!savedSnap.churchCity" />
                      Ciudad de la iglesia
                    </label>
                    <input
                      v-model="churchCity"
                      type="text"
                      class="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition"
                    />
                  </div>

                  <!-- Fecha de junta administrativa -->
                  <div>
                    <label class="flex items-center gap-1 text-xs font-medium text-gray-500 mb-1.5">
                      <FieldStatus
                        v-if="savedSnap"
                        :filled="!!savedSnap.administrativeMeetingDate"
                      />
                      Fecha de junta administrativa
                    </label>
                    <input
                      v-model="administrativeMeetingDate"
                      type="date"
                      class="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition"
                    />
                  </div>
                </div>
              </div>

              <!-- ── Columna derecha: pastor y notas ── -->
              <div class="space-y-4">
                <div class="flex items-center gap-2">
                  <div class="w-1 h-4 rounded-full bg-[#fdc710]" />
                  <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Pastor oficiante
                  </h3>
                </div>

                <div class="space-y-3">
                  <!-- Pastor autocomplete -->
                  <div class="relative">
                    <label class="flex items-center gap-1 text-xs font-medium text-gray-500 mb-1.5">
                      <FieldStatus v-if="savedSnap" :filled="!!savedSnap.officatingPastor" />
                      Nombre del pastor
                      <span class="text-gray-400 font-normal">(busca por nombre o DNI)</span>
                    </label>
                    <div class="relative">
                      <input
                        v-model="pastorQuery"
                        type="text"
                        placeholder="Escribe nombre o DNI…"
                        autocomplete="off"
                        :disabled="!!selectedPastor"
                        @input="onPastorInput"
                        @blur="closePastorDropDelayed"
                        @focus="openPastorDropIfHasSuggestions"
                        class="w-full px-3 py-2.5 text-sm rounded-xl border transition"
                        :class="
                          selectedPastor
                            ? 'border-gray-100 bg-gray-50 text-gray-700 cursor-not-allowed pr-9'
                            : 'border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a]'
                        "
                      />
                      <!-- Clear button when a pastor is locked -->
                      <button
                        v-if="selectedPastor"
                        type="button"
                        @click="clearPastorSelection"
                        class="absolute inset-y-0 right-2 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                        title="Cambiar pastor"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          class="w-4 h-4"
                        >
                          <path
                            d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"
                          />
                        </svg>
                      </button>
                    </div>
                    <!-- Dropdown suggestions -->
                    <Transition name="fade">
                      <div
                        v-if="showPastorDrop && pastorSuggestions.length"
                        class="absolute z-20 mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden"
                      >
                        <button
                          v-for="p in pastorSuggestions"
                          :key="p.id"
                          type="button"
                          @mousedown.prevent="selectPastor(p)"
                          class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#04395a]/5 transition-colors text-left"
                        >
                          <div
                            class="w-7 h-7 rounded-lg bg-[#04395a]/8 flex items-center justify-center shrink-0"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke-width="1.5"
                              stroke="#04395a"
                              class="w-3.5 h-3.5"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
                              />
                            </svg>
                          </div>
                          <div class="min-w-0">
                            <p class="text-sm font-medium text-gray-700 truncate">
                              {{ p.full_name }}
                            </p>
                            <p class="text-xs text-gray-400 font-mono">{{ p.dni }}</p>
                          </div>
                        </button>
                      </div>
                    </Transition>
                  </div>

                  <!-- DNI del pastor -->
                  <div>
                    <label class="flex items-center gap-1 text-xs font-medium text-gray-500 mb-1.5">
                      <FieldStatus v-if="savedSnap" :filled="!!savedSnap.officatingPastorDni" />
                      DNI del pastor
                    </label>
                    <input
                      :value="officatingPastorDni"
                      type="text"
                      placeholder="Se completa al seleccionar un pastor…"
                      disabled
                      class="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-100 bg-gray-50 cursor-not-allowed"
                      :class="officatingPastorDni ? 'text-gray-700' : 'text-gray-400 italic'"
                    />
                  </div>
                </div>

                <!-- Secretario/a -->
                <div class="flex items-center gap-2 mt-2">
                  <div class="w-1 h-4 rounded-full bg-[#068ab8]" />
                  <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Secretario/a
                  </h3>
                </div>
                <div>
                  <label class="flex items-center gap-1 text-xs font-medium text-gray-500 mb-1.5">
                    <FieldStatus :filled="!!churchSecretary" />
                    Nombre del secretario/a de la iglesia/grupo organizado
                  </label>
                  <input
                    :value="churchSecretary"
                    type="text"
                    disabled
                    :placeholder="
                      churchSecretary ? '' : 'Sin secretaria principal activa registrada'
                    "
                    class="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-100 bg-gray-50 cursor-not-allowed"
                    :class="churchSecretary ? 'text-gray-700' : 'text-gray-400 italic'"
                  />
                </div>
              </div>
            </div>

            <!-- Guardar -->
            <div
              v-if="canWrite"
              class="flex items-center gap-3 mt-6 pt-4 pb-6 border-t border-gray-100"
            >
              <button
                type="button"
                :disabled="saving"
                @click="save"
                class="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-[#04395a] hover:bg-[#068ab8] disabled:opacity-50 transition-colors"
              >
                <svg v-if="saving" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
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
                <svg
                  v-else
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
                    d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                  />
                </svg>
                {{ saving ? 'Guardando…' : 'Guardar' }}
              </button>
              <Transition name="fade">
                <span
                  v-if="saveMsg"
                  class="text-xs font-medium"
                  :class="saveMsgError ? 'text-red-600' : 'text-emerald-600'"
                  >{{ saveMsg }}</span
                >
              </Transition>
            </div>
          </template>
        </div>

        <!-- ════════════════════════════════════════════════════════════════ -->
        <!-- TAB 3: DECLARACIÓN DE FE                                         -->
        <!-- ════════════════════════════════════════════════════════════════ -->
        <div v-show="activeTab === 'fe'" class="pt-4">
          <template v-if="loading">
            <div class="space-y-3">
              <div
                v-for="i in 6"
                :key="i"
                class="h-10 rounded-xl bg-gray-100 animate-pulse"
                :style="{ opacity: 1 - i * 0.1 }"
              />
            </div>
          </template>
          <template v-else>
            <div class="space-y-6">
              <!-- Preguntas sí/no (colapsable) -->
              <div>
                <button
                  type="button"
                  @click="showFaithQuestions = !showFaithQuestions"
                  class="w-full flex items-center gap-2 mb-1 group"
                >
                  <div class="w-1 h-4 rounded-full bg-[#068ab8] shrink-0" />
                  <h3
                    class="flex-1 text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1 text-left"
                  >
                    <FieldStatus v-if="savedSnap" :filled="savedSnap.faithAnswersCount > 0" />
                    Preguntas de seguimiento
                    <span
                      v-if="savedSnap && savedSnap.faithAnswersCount > 0"
                      class="normal-case font-normal text-gray-400"
                    >
                      ({{ savedSnap.faithAnswersCount }}/{{
                        Object.keys(faithAnswers).length || 13
                      }}
                      respondidas)
                    </span>
                  </h3>
                  <span
                    class="shrink-0 flex items-center gap-1 text-[11px] font-medium text-[#068ab8] group-hover:text-[#04395a] transition-colors"
                  >
                    {{ showFaithQuestions ? 'Ocultar' : 'Ver preguntas' }}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke-width="2.5"
                      stroke="currentColor"
                      class="w-3.5 h-3.5 transition-transform duration-200"
                      :class="showFaithQuestions ? 'rotate-180' : ''"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="m19.5 8.25-7.5 7.5-7.5-7.5"
                      />
                    </svg>
                  </span>
                </button>

                <Transition
                  enter-active-class="transition-all duration-200 ease-out overflow-hidden"
                  enter-from-class="opacity-0 max-h-0"
                  enter-to-class="opacity-100 max-h-[9999px]"
                  leave-active-class="transition-all duration-150 ease-in overflow-hidden"
                  leave-from-class="opacity-100 max-h-[9999px]"
                  leave-to-class="opacity-0 max-h-0"
                >
                  <div v-show="showFaithQuestions" class="space-y-2 mt-3">
                    <div
                      v-for="(question, i) in FAITH_QUESTIONS"
                      :key="i"
                      class="flex items-center gap-3 p-3 rounded-xl border border-gray-100"
                    >
                      <p class="flex-1 text-sm text-gray-700">{{ question }}</p>
                      <div class="flex gap-1.5 shrink-0">
                        <button
                          type="button"
                          @click="setFaithAnswer(i, true)"
                          class="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                          :class="
                            faithAnswers[String(i)] === true
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'border-gray-200 text-gray-500 hover:border-emerald-400 hover:text-emerald-600'
                          "
                        >
                          Sí
                        </button>
                        <button
                          type="button"
                          @click="setFaithAnswer(i, false)"
                          class="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                          :class="
                            faithAnswers[String(i)] === false
                              ? 'bg-red-500 border-red-500 text-white'
                              : 'border-gray-200 text-gray-500 hover:border-red-400 hover:text-red-600'
                          "
                        >
                          No
                        </button>
                      </div>
                    </div>
                  </div>
                </Transition>
              </div>

              <!-- Consentimiento -->
              <div class="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div class="flex items-center gap-1.5 mb-2">
                  <FieldStatus v-if="savedSnap" :filled="savedSnap.consentAccepted" />
                  <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide"
                    >Consentimiento</span
                  >
                </div>
                <label class="flex items-start gap-3 cursor-pointer select-none">
                  <!-- Custom checkbox -->
                  <div
                    class="shrink-0 mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors"
                    :class="
                      consentAccepted ? 'border-[#04395a] bg-[#04395a]' : 'border-gray-300 bg-white'
                    "
                  >
                    <svg
                      v-if="consentAccepted"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke-width="3"
                      stroke="white"
                      class="w-3 h-3"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="m4.5 12.75 6 6 9-13.5"
                      />
                    </svg>
                  </div>
                  <input type="checkbox" v-model="consentAccepted" class="sr-only" />
                  <p class="text-[11px] text-gray-500 leading-relaxed">
                    creo y acepto las creencias fundamentales, normas y principios de la iglesia
                    adventista del séptimo día, incluida la disciplina eclesiástica, expresada en el
                    "manual de la iglesia", y deseo ser miembro de esta congregación local de la
                    iglesia adventista mundial. con mi firma doy mi expreso consentimiento para que
                    la iglesia adventista del séptimo día utilice mis datos personales de acuerdo
                    con la ley, específicamente en el cumplimiento de sus finalidades
                    institucionales. la política de privacidad está publicada en el sitio web:
                    <a
                      href="http://adv.st/privacidad"
                      target="_blank"
                      class="underline hover:text-[#04395a]"
                      >http://adv.st/privacidad</a
                    >
                  </p>
                </label>
                <Transition name="fade">
                  <p
                    v-if="!consentAccepted"
                    class="mt-2 ml-8 text-[10px] text-amber-600 font-medium"
                  >
                    Debes aceptar este consentimiento para poder generar el PDF.
                  </p>
                </Transition>
              </div>

              <!-- Firma -->
              <div class="space-y-3">
                <div class="flex items-center gap-1.5">
                  <FieldStatus v-if="savedSnap" :filled="!!signatureData" />
                  <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Firma del candidato
                  </span>
                  <span v-if="signatureSaved" class="text-[10px] text-emerald-600 font-medium ml-1">
                    ✓ guardada
                  </span>
                </div>
                <SignaturePad v-model="signatureData" @saved="signatureSaved = true" />
              </div>

              <!-- Guardar -->
              <div
                v-if="canWrite"
                class="flex items-center gap-3 pt-2 pb-6 border-t border-gray-100"
              >
                <button
                  type="button"
                  :disabled="saving"
                  @click="save"
                  class="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-[#04395a] hover:bg-[#068ab8] disabled:opacity-50 transition-colors"
                >
                  <svg v-if="saving" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
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
                  <svg
                    v-else
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
                      d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                    />
                  </svg>
                  {{ saving ? 'Guardando…' : 'Guardar' }}
                </button>
                <button
                  type="button"
                  :disabled="generatingPdf || !consentAccepted"
                  @click="handleGeneratePdf"
                  class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-[#04395a] bg-[#04395a]/10 hover:bg-[#04395a]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  :title="!consentAccepted ? 'Acepta el consentimiento primero' : ''"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="currentColor"
                    class="w-4 h-4"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m.75 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                    />
                  </svg>
                  {{ generatingPdf ? 'Generando…' : 'Generar PDF' }}
                </button>
                <Transition name="fade">
                  <span v-if="saveMsg" class="text-xs text-emerald-600 font-medium">{{
                    saveMsg
                  }}</span>
                </Transition>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- ── Vista previa ──────────────────────────────────────────────────────── -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showPreview"
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          @click.self="closePreview"
        >
          <div
            class="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden"
          >
            <!-- Modal header -->
            <div
              class="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0"
            >
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg bg-[#04395a]/10 flex items-center justify-center">
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
                      d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178Z"
                    />
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                    />
                  </svg>
                </div>
                <div>
                  <p class="text-sm font-semibold text-gray-800">Vista previa de la ficha</p>
                  <p class="text-xs text-gray-400">{{ person?.full_name }}</p>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  :disabled="generatingPdf"
                  @click="handleGeneratePdf"
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-[#04395a] hover:bg-[#068ab8] disabled:opacity-50 transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="currentColor"
                    class="w-3.5 h-3.5"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m.75 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                    />
                  </svg>
                  Descargar PDF
                </button>
                <button
                  type="button"
                  @click="closePreview"
                  class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="2"
                    stroke="currentColor"
                    class="w-4 h-4"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- PDF iframe — mismo output que la descarga -->
            <iframe
              v-if="pdfPreviewUrl"
              :src="pdfPreviewUrl"
              class="flex-1 w-full border-0"
              style="min-height: 70vh"
            />
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ── Delete confirm ─────────────────────────────────────────────────── -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showDeleteConfirm"
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          @click.self="showDeleteConfirm = false"
        >
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="#ef4444"
                  class="w-5 h-5"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                  />
                </svg>
              </div>
              <div>
                <p class="text-sm font-semibold text-gray-800">¿Eliminar esta ficha?</p>
                <p class="text-xs text-gray-400 mt-0.5">Esta acción no se puede deshacer.</p>
              </div>
            </div>
            <div class="flex gap-2 pt-1">
              <button
                type="button"
                @click="showDeleteConfirm = false"
                class="flex-1 py-2 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                @click="executeDelete"
                :disabled="deleting"
                class="flex-1 py-2 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 disabled:opacity-60 transition-colors"
              >
                {{ deleting ? 'Eliminando…' : 'Eliminar' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Toast: guardado exitosamente -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 translate-y-2"
      >
        <div
          v-if="showSavedToast"
          style="
            position:fixed;top:20px;right:20px;z-index:2147483647;
            width:340px;padding:16px 18px;border-radius:14px;
            background:#f0fdf4;border:1px solid #86efac;
            box-shadow:0 10px 40px rgba(0,0,0,0.2);
            display:flex;align-items:flex-start;gap:12px;
            font-family:system-ui,sans-serif;cursor:pointer;
          "
          @click="showSavedToast = false"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="#16a34a" style="width:22px;height:22px;flex-shrink:0;margin-top:1px">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <div style="flex:1">
            <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#14532d">Datos guardados correctamente</p>
            <p style="margin:0;font-size:13px;color:#166534;line-height:1.45">La información de la ficha ha sido guardada en el sistema.</p>
          </div>
          <span style="color:#15803d;font-size:20px;line-height:1">&times;</span>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
/*
  Los <input type="radio|checkbox" class="sr-only"> usan position:absolute sin
  un ancestro posicionado. Al recibir foco el navegador intenta hacer scroll
  para mostrarlos, desplazando todo el contenido fuera de la vista.
  Con position:fixed quedan anclados a la esquina del viewport: siguen siendo
  invisibles (1×1 px, clip) pero el navegador ya considera que están "a la vista"
  y no produce ningún scroll.
*/
input[type='radio'].sr-only,
input[type='checkbox'].sr-only {
  position: fixed;
  top: 0;
  left: 0;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-active > *,
.modal-leave-active > * {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}
.modal-enter-from > *,
.modal-leave-to > * {
  transform: scale(0.96) translateY(8px);
  opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition:
    max-height 0.2s ease,
    opacity 0.2s ease;
  overflow: hidden;
}
.slide-down-enter-from,
.slide-down-leave-to {
  max-height: 0;
  opacity: 0;
}
.slide-down-enter-to,
.slide-down-leave-from {
  max-height: 60px;
  opacity: 1;
}
</style>
