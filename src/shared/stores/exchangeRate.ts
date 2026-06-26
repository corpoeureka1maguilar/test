import { create } from 'zustand'

interface ExchangeRateState {
  rate: number
  setRate(rate: number): void
}

export const useExchangeRateStore = create<ExchangeRateState>((set) => ({
  rate: 0,
  setRate: (rate) => set({ rate }),
}))
