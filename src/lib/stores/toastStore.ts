import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info'

/** Optionale Aktion in einer Meldung — z. B. „Rückgängig" nach dem Entfernen. */
export interface ToastAction {
  label: string
  onClick: () => void
}

export interface Toast {
  id: number
  message: string
  type: ToastType
  action?: ToastAction
}

interface ToastStore {
  toasts: Toast[]
  show: (message: string, type?: ToastType, action?: ToastAction) => void
  dismiss: (id: number) => void
}

let counter = 0

export const useToast = create<ToastStore>((set, get) => ({
  toasts: [],
  show: (message, type = 'success', action) => {
    const id = ++counter
    set((s) => ({ toasts: [...s.toasts, { id, message, type, action }] }))
    // Mit Aktion länger stehen lassen, damit „Rückgängig" in Ruhe getroffen werden kann.
    setTimeout(() => get().dismiss(id), action ? 6000 : 3200)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
}))
