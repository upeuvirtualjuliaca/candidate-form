<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps<{
  modelValue?: string | null   // base64 PNG guardado
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
  'saved': [dataUrl: string]
}>()

const canvasRef  = ref<HTMLCanvasElement | null>(null)
const isDrawing  = ref(false)
const hasStrokes = ref(false)
const isEmpty    = ref(true)

let ctx: CanvasRenderingContext2D | null = null
let lastX = 0
let lastY = 0

// ── Setup canvas ────────────────────────────────────────────────────────────

function setupCanvas() {
  const canvas = canvasRef.value
  if (!canvas) return
  ctx = canvas.getContext('2d')!

  // Escala para pantallas de alta densidad (retina / tablets)
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  canvas.width  = rect.width  * dpr
  canvas.height = rect.height * dpr
  ctx.scale(dpr, dpr)

  ctx.strokeStyle = '#1e293b'
  ctx.lineWidth   = 2.5
  ctx.lineCap     = 'round'
  ctx.lineJoin    = 'round'

  // Restaurar firma guardada si existe
  if (props.modelValue) {
    const img = new Image()
    img.onload = () => ctx!.drawImage(img, 0, 0, rect.width, rect.height)
    img.src = props.modelValue
    isEmpty.value    = false
    hasStrokes.value = true
  }
}

function getPos(e: MouseEvent | Touch): { x: number; y: number } {
  const canvas = canvasRef.value!
  const rect   = canvas.getBoundingClientRect()
  const src    = 'clientX' in e ? e : e
  return {
    x: src.clientX - rect.left,
    y: src.clientY - rect.top,
  }
}

// ── Mouse events ─────────────────────────────────────────────────────────────

function onMouseDown(e: MouseEvent) {
  if (!ctx) return
  isDrawing.value = true
  const { x, y } = getPos(e)
  lastX = x; lastY = y
  ctx.beginPath()
  ctx.moveTo(x, y)
}

function onMouseMove(e: MouseEvent) {
  if (!isDrawing.value || !ctx) return
  const { x, y } = getPos(e)
  ctx.lineTo(x, y)
  ctx.stroke()
  lastX = x; lastY = y
  isEmpty.value    = false
  hasStrokes.value = true
}

function onMouseUp() {
  isDrawing.value = false
  ctx?.beginPath()
}

// ── Touch events (mobile / tablet) ──────────────────────────────────────────

function onTouchStart(e: TouchEvent) {
  e.preventDefault()
  if (!ctx) return
  const touch = e.touches[0]
  if (!touch) return
  isDrawing.value = true
  const { x, y } = getPos(touch)
  lastX = x; lastY = y
  ctx.beginPath()
  ctx.moveTo(x, y)
}

function onTouchMove(e: TouchEvent) {
  e.preventDefault()
  if (!isDrawing.value || !ctx) return
  const touch = e.touches[0]
  if (!touch) return
  const { x, y } = getPos(touch)
  ctx.lineTo(x, y)
  ctx.stroke()
  lastX = x; lastY = y
  isEmpty.value    = false
  hasStrokes.value = true
}

function onTouchEnd(e: TouchEvent) {
  e.preventDefault()
  isDrawing.value = false
  ctx?.beginPath()
}

// ── Actions ──────────────────────────────────────────────────────────────────

function clear() {
  if (!ctx || !canvasRef.value) return
  const rect = canvasRef.value.getBoundingClientRect()
  ctx.clearRect(0, 0, rect.width, rect.height)
  isEmpty.value    = true
  hasStrokes.value = false
  emit('update:modelValue', null)
}

function save() {
  if (!canvasRef.value || isEmpty.value) return
  const dataUrl = canvasRef.value.toDataURL('image/png')
  emit('update:modelValue', dataUrl)
  emit('saved', dataUrl)
}

function download() {
  if (!canvasRef.value || isEmpty.value) return
  const dataUrl = canvasRef.value.toDataURL('image/png')
  const a = document.createElement('a')
  a.href     = dataUrl
  a.download = 'firma.png'
  a.click()
}

// ── Resize handler ───────────────────────────────────────────────────────────

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  setupCanvas()
  resizeObserver = new ResizeObserver(() => setupCanvas())
  if (canvasRef.value) resizeObserver.observe(canvasRef.value)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})
</script>

<template>
  <div class="space-y-3">

    <!-- Canvas area -->
    <div class="relative rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 overflow-hidden"
      style="touch-action: none;">

      <!-- Placeholder text when empty -->
      <div v-if="isEmpty"
        class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
          stroke-width="1.3" stroke="#d1d5db" class="w-10 h-10">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M16.862 4.487 18.55 2.8a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z" />
        </svg>
        <p class="text-xs text-gray-400 font-medium">Firma aquí con el dedo o lápiz</p>
      </div>

      <canvas
        ref="canvasRef"
        class="w-full cursor-crosshair"
        style="height: 180px; display: block; touch-action: none;"
        @mousedown="onMouseDown"
        @mousemove="onMouseMove"
        @mouseup="onMouseUp"
        @mouseleave="onMouseUp"
        @touchstart="onTouchStart"
        @touchmove="onTouchMove"
        @touchend="onTouchEnd"
      />
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-2 flex-wrap">
      <!-- Clear -->
      <button
        type="button"
        @click="clear"
        :disabled="isEmpty"
        class="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
          stroke-width="1.8" stroke="currentColor" class="w-3.5 h-3.5">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
        Limpiar
      </button>

      <!-- Save -->
      <button
        type="button"
        @click="save"
        :disabled="isEmpty"
        class="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#04395a] text-white hover:bg-[#068ab8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
          stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
        Guardar firma
      </button>

      <!-- Download PNG -->
      <button
        type="button"
        @click="download"
        :disabled="isEmpty"
        class="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-[#04395a]/30 text-[#04395a] hover:bg-[#04395a]/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
          stroke-width="1.8" stroke="currentColor" class="w-3.5 h-3.5">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        Descargar .png
      </button>

      <!-- Saved indicator -->
      <Transition name="fade">
        <span v-if="modelValue && !isEmpty"
          class="flex items-center gap-1 text-xs text-emerald-600 font-medium ml-auto">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            stroke-width="2.5" stroke="currentColor" class="w-3.5 h-3.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
          Firma guardada
        </span>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease }
.fade-enter-from, .fade-leave-to { opacity: 0 }
</style>
