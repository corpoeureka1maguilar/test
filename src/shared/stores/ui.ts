import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Toast } from '@/shared/types/types'
import { randomUUID } from '@/shared/lib/cryptoUtils'

interface UIState {
  loading: boolean
  toasts: Toast[]
}

interface UIActions {
  setLoading(v: boolean): void
  pushToast(type: Toast['type'], message: string, sticky?: boolean): void
  dismissToast(id: string): void
  clearToasts(): void
}

export const useUIStore = create<UIState & UIActions>()(devtools((set) => ({
  loading: false,
  toasts: [],

  setLoading(v) {
    set({ loading: v })
  },

  pushToast(type, message, sticky = false) {
    const id = randomUUID()
    set((s) => ({ toasts: [...s.toasts, { id, type, message, sticky }] }))
  },

  dismissToast(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },

  clearToasts() {
    set({ toasts: [] })
  }
}), { name: 'ui' }))
