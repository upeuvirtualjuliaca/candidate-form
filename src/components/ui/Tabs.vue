<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue'

export interface Tab {
  key: string
  label: string
}

const props = defineProps<{
  tabs: Tab[]
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// ── Sliding indicator ──────────────────────────────────────────────────────
const tabRefs    = ref<HTMLButtonElement[]>([])
const barStyle   = ref({ left: '0px', width: '0px' })
const mounted    = ref(false)

function updateBar() {
  const idx = props.tabs.findIndex((t) => t.key === props.modelValue)
  const el  = tabRefs.value[idx]
  if (el) {
    barStyle.value = { left: `${el.offsetLeft}px`, width: `${el.offsetWidth}px` }
  }
}

watch(() => props.modelValue, () => nextTick(updateBar))
onMounted(() => { mounted.value = true; nextTick(updateBar) })

function select(key: string) {
  emit('update:modelValue', key)
}
</script>

<template>
  <div>
    <!-- ── Tab bar ─────────────────────────────────────────────────────── -->
    <div class="relative">
      <!-- Scrollable row -->
      <div class="flex overflow-x-auto pb-px tab-scroll">
        <button
          v-for="(tab, i) in tabs"
          :key="tab.key"
          :ref="(el) => { if (el) tabRefs[i] = el as HTMLButtonElement }"
          type="button"
          @click="select(tab.key)"
          :class="[
            'relative flex-shrink-0 px-5 py-3 text-sm font-medium whitespace-nowrap',
            'transition-colors duration-200 focus-visible:outline-none',
            modelValue === tab.key
              ? 'text-[#04395a]'
              : 'text-gray-400 hover:text-gray-600',
          ]"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Bottom border (full width) -->
      <div class="absolute bottom-0 left-0 right-0 h-px bg-gray-200" />

      <!-- Sliding active indicator -->
      <div
        class="absolute bottom-0 h-0.5 bg-[#04395a] rounded-full pointer-events-none"
        :class="mounted ? 'transition-all duration-250 ease-out' : ''"
        :style="barStyle"
      />
    </div>

    <!-- ── Tab content ─────────────────────────────────────────────────── -->
    <div class="mt-6">
      <template v-for="tab in tabs" :key="tab.key">
        <!--
          v-show keeps component state alive (important for import form).
          Each panel is always in the DOM, just hidden.
        -->
        <div v-show="modelValue === tab.key">
          <slot :name="tab.key" />
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* Hide scrollbar but keep scroll functionality */
.tab-scroll {
  scrollbar-width: none;
}
.tab-scroll::-webkit-scrollbar {
  display: none;
}
</style>
