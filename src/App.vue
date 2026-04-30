<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const showDup = ref(false)
const showNew = ref(false)

onMounted(() => {
  router.afterEach((to) => {
    if (to.query.dup === '1') {
      showDup.value = true
      setTimeout(() => { showDup.value = false }, 6000)
      router.replace({ query: {} })
    } else if (to.query.new === '1') {
      showNew.value = true
      setTimeout(() => { showNew.value = false }, 5000)
      router.replace({ query: {} })
    }
  })
})
</script>

<template>
  <RouterView />

  <!-- Toast: duplicado -->
  <div
    v-if="showDup"
    style="
      position:fixed;top:20px;right:20px;z-index:2147483647;
      width:340px;padding:16px 18px;border-radius:14px;
      background:#fffbeb;border:1px solid #fcd34d;
      box-shadow:0 10px 40px rgba(0,0,0,0.2);
      display:flex;align-items:flex-start;gap:12px;
      font-family:system-ui,sans-serif;cursor:pointer;
    "
    @click="showDup = false"
  >
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="#d97706" style="width:22px;height:22px;flex-shrink:0;margin-top:1px">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
    <div style="flex:1">
      <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#78350f">Candidato ya registrado</p>
      <p style="margin:0;font-size:13px;color:#92400e;line-height:1.45">Este candidato ya tiene una ficha registrada en el sistema.</p>
    </div>
    <span style="color:#b45309;font-size:20px;line-height:1">&times;</span>
  </div>

  <!-- Toast: éxito creación -->
  <div
    v-if="showNew"
    style="
      position:fixed;top:20px;right:20px;z-index:2147483647;
      width:340px;padding:16px 18px;border-radius:14px;
      background:#f0fdf4;border:1px solid #86efac;
      box-shadow:0 10px 40px rgba(0,0,0,0.2);
      display:flex;align-items:flex-start;gap:12px;
      font-family:system-ui,sans-serif;cursor:pointer;
    "
    @click="showNew = false"
  >
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="#16a34a" style="width:22px;height:22px;flex-shrink:0;margin-top:1px">
      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
    <div style="flex:1">
      <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#14532d">Ficha creada exitosamente</p>
      <p style="margin:0;font-size:13px;color:#166534;line-height:1.45">La ficha del candidato ha sido registrada en el sistema.</p>
    </div>
    <span style="color:#15803d;font-size:20px;line-height:1">&times;</span>
  </div>
</template>
