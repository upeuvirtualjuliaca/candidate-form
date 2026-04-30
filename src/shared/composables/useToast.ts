import { ref } from 'vue'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: number
  type: ToastType
  title: string
  message?: string
  duration: number
}

let nextId = 0
const toasts = ref<Toast[]>([])

function show(type: ToastType, title: string, message?: string, duration = 5000) {
  const id = nextId++
  toasts.value.push({ id, type, title, message, duration })
  setTimeout(() => dismiss(id), duration)
}

function dismiss(id: number) {
  toasts.value = toasts.value.filter((t) => t.id !== id)
}

export function useToast() {
  return {
    toasts,
    dismiss,
    success: (title: string, message?: string, duration?: number) =>
      show('success', title, message, duration),
    error: (title: string, message?: string, duration?: number) =>
      show('error', title, message, duration),
    warning: (title: string, message?: string, duration?: number) =>
      show('warning', title, message, duration),
    info: (title: string, message?: string, duration?: number) =>
      show('info', title, message, duration),
  }
}
