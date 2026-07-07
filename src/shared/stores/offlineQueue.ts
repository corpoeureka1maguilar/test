import { create } from 'zustand'

// Espejo síncrono de la cola offline (ver orderQueue.ts) — IndexedDB es la
// única fuente de verdad; este store SOLO refleja el conteo para que
// useShouldBlockUI() y los guards de la state machine puedan leerlo
// sincrónicamente sin tocar IndexedDB. Toda mutación de la cola debe
// actualizar ambos, en ese orden: IndexedDB primero, luego este count.
interface OfflineQueueState {
  count: number
  setCount(count: number): void
}

export const useOfflineQueueStore = create<OfflineQueueState>((set) => ({
  count: 0,
  setCount: (count) => set({ count })
}))
