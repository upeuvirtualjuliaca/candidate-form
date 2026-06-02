import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Campaign } from '../services/campaigns.service'

export interface CampaignNotification {
  title: string
  msg?:  string
  type:  'info' | 'error'
}

export const useCampaignStore = defineStore('campaign', () => {
  const selected     = ref<Campaign | null>(null)
  const notification = ref<CampaignNotification | null>(null)
  let   notifTimer   = 0

  function todayIso(): string {
    return new Date().toISOString().split('T')[0]
  }

  // Función de validación — llamada directa, sin refs ni computeds
  function checkValidity(): { allowed: boolean; reason?: string } {
    const c = selected.value
    if (!c) {
      return { allowed: false, reason: 'No hay ninguna campaña seleccionada en el dropdown.' }
    }
    const today = todayIso()
    if (!c.is_active) {
      return { allowed: false, reason: `La campaña "${c.name}" no está activa.` }
    }
    if (today < c.start_date) {
      return { allowed: false, reason: `La campaña "${c.name}" aún no ha comenzado.` }
    }
    if (today > c.end_date) {
      return { allowed: false, reason: `La campaña "${c.name}" ha finalizado. No es posible crear nuevas fichas.` }
    }
    return { allowed: true }
  }

  function setSelected(campaign: Campaign | null) {
    selected.value = campaign
  }

  function notify(title: string, msg?: string, type: 'info' | 'error' = 'info') {
    clearTimeout(notifTimer)
    notification.value = { title, msg, type }
    notifTimer = window.setTimeout(() => { notification.value = null }, 4500)
  }

  function clearNotification() {
    clearTimeout(notifTimer)
    notification.value = null
  }

  return { selected, checkValidity, notification, setSelected, notify, clearNotification }
})
