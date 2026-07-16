import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info'
export interface Toast {
  id: number
  message: string
  type: ToastType
}

interface ToastStore {
  toasts: Toast[]
  show: (message: string, type?: ToastType) => void
  dismiss: (id: number) => void
}

let counter = 0

export const useToast = create<ToastStore>((set, get) => ({
  toasts: [],
  show: (message, type = 'success') => {
    const id = ++counter
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => get().dismiss(id), 3200)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
}))
