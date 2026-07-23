import { describe, it, expect, beforeEach } from 'vitest'
import { useExchangeRateStore } from './exchangeRate'

beforeEach(() => {
  useExchangeRateStore.setState({ rate: 0 })
})

describe('exchangeRateStore', () => {
  it('has initial rate of 0', () => {
    expect(useExchangeRateStore.getState().rate).toBe(0)
  })

  it('updates rate using setRate', () => {
    useExchangeRateStore.getState().setRate(36.5)
    expect(useExchangeRateStore.getState().rate).toBe(36.5)
  })
})
