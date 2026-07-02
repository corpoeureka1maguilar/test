import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ExchangeRateState {
  rate: number
  setRate(rate: number): void
}

// Persistido para que pantallas como /advanced tengan una tasa disponible
// aunque se abran directo, sin haber pasado antes por el catálogo de productos
export const useExchangeRateStore = create<ExchangeRateState>()(
  persist(
    (set) => ({
      rate: 0,
      setRate: (rate) => set({ rate }),
    }),
    { name: 'autopay-exchange-rate' }
  )
)
