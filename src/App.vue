<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCampaignStore } from '@/modules/campaigns/store/campaign.store'
import { storeToRefs } from 'pinia'

const router = useRouter()
const showDup     = ref(false)
const showNew     = ref(false)
const showDeleted = ref(false)

// ── Campaign toast (lee del store) ─────────────────────────────────────────
const campaignStore = useCampaignStore()
const { notification } = storeToRefs(campaignStore)

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
    } else if (to.query.deleted === '1') {
      showDeleted.value = true
      setTimeout(() => { showDeleted.value = false }, 5000)
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

  <!-- Toast: ficha eliminada -->
  <div
    v-if="showDeleted"
    style="
      position:fixed;top:20px;right:20px;z-index:2147483647;
      width:340px;padding:16px 18px;border-radius:14px;
      background:#fef2f2;border:1px solid #fca5a5;
      box-shadow:0 10px 40px rgba(0,0,0,0.2);
      display:flex;align-items:flex-start;gap:12px;
      font-family:system-ui,sans-serif;cursor:pointer;
    "
    @click="showDeleted = false"
  >
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="#dc2626" style="width:22px;height:22px;flex-shrink:0;margin-top:1px">
      <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
    <div style="flex:1">
      <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#7f1d1d">Ficha eliminada</p>
      <p style="margin:0;font-size:13px;color:#991b1b;line-height:1.45">La ficha del candidato ha sido eliminada del sistema.</p>
    </div>
    <span style="color:#dc2626;font-size:20px;line-height:1">&times;</span>
  </div>

  <!-- Toast: campaña -->
  <Transition name="toast-slide">
    <div
      v-if="notification"
      :style="`
        position:fixed;top:20px;right:20px;z-index:2147483647;
        width:360px;padding:16px 18px;border-radius:14px;
        background:${notification.type === 'error' ? '#fef2f2' : '#eff6ff'};
        border:1px solid ${notification.type === 'error' ? '#fca5a5' : '#93c5fd'};
        box-shadow:0 10px 40px rgba(0,0,0,0.2);
        display:flex;align-items:flex-start;gap:12px;
        font-family:system-ui,sans-serif;cursor:pointer;
      `"
      @click="campaignStore.clearNotification()"
    >
      <svg v-if="notification.type === 'error'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="#dc2626" style="width:22px;height:22px;flex-shrink:0;margin-top:1px">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>
      <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="#2563eb" style="width:22px;height:22px;flex-shrink:0;margin-top:1px">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
      </svg>
      <div style="flex:1">
        <p :style="`margin:0 0 3px;font-size:13px;font-weight:700;color:${notification.type === 'error' ? '#7f1d1d' : '#1e3a5f'}`">
          {{ notification.title }}
        </p>
        <p v-if="notification.msg" :style="`margin:0;font-size:12px;color:${notification.type === 'error' ? '#991b1b' : '#1d4ed8'};line-height:1.45`">
          {{ notification.msg }}
        </p>
      </div>
      <span :style="`color:${notification.type === 'error' ? '#dc2626' : '#3b82f6'};font-size:20px;line-height:1`">&times;</span>
    </div>
  </Transition>

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
