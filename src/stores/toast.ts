import { defineStore } from 'pinia'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: number
  type: ToastType
  title: string
  message?: string
}

let _id = 0

export const useToastStore = defineStore('toast', {
  state: () => ({
    toasts: [] as Toast[],
    pending: null as { type: ToastType; title: string; message?: string } | null,
  }),
  actions: {
    show(type: ToastType, title: string, message?: string, duration = 5000) {
      const id = _id++
      this.toasts.push({ id, type, title, message })
      setTimeout(() => {
        this.toasts = this.toasts.filter((t) => t.id !== id)
      }, duration)
    },
    dismiss(id: number) {
      this.toasts = this.toasts.filter((t) => t.id !== id)
    },
    queue(type: ToastType, title: string, message?: string) {
      this.pending = { type, title, message }
    },
    flushPending() {
      if (this.pending) {
        this.show(this.pending.type, this.pending.title, this.pending.message)
        this.pending = null
      }
    },
    success(title: string, message?: string) { this.show('success', title, message) },
    error(title: string, message?: string) { this.show('error', title, message) },
    warning(title: string, message?: string) { this.show('warning', title, message) },
    info(title: string, message?: string) { this.show('info', title, message) },
  },
})
